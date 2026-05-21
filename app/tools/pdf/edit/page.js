'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PDFDocument, rgb, StandardFonts, PDFName, PDFString, PDFArray } from 'pdf-lib';

/* ==========================================================================
   PDF Edit — production editor
   --------------------------------------------------------------------------
   Coordinate system
     - Annotations are stored in **PDF points** (top-left origin, same axes as
       the pdfjs canvas). This makes them scale-invariant: zoom in/out doesn't
       move or distort them.
     - When rendering on screen:  screen_px = points * scale
     - When saving with pdf-lib:  flip Y (pdf-lib uses bottom-left origin)
   --------------------------------------------------------------------------
   Interaction model
     - Click empty canvas: place a default-sized annotation at the click point
     - Click + drag empty canvas: draw an annotation at the dragged size
     - Click an annotation: select it, show handles + properties panel
     - Drag an annotation: move it (clamped to page bounds)
     - Drag any of 8 handles: resize (Shift OR image type = keep aspect ratio)
     - Double-click text: edit
     - Del / Backspace: delete selected
     - Esc: deselect
     - Cmd/Ctrl+Z: undo  ·  Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y): redo
   ========================================================================== */

const TOOLS = [
  { id: 'select',   label: '↖ Select',  title: 'Select / move / resize annotations' },
  { id: 'text',     label: 'T Text',     title: 'Add text' },
  { id: 'sign',     label: '✍ Sign',     title: 'Add signature text' },
  { id: 'link',     label: '🔗 Link',    title: 'Add clickable link region' },
  { id: 'image',    label: '🖼 Image',   title: 'Stamp an image' },
  { id: 'shape',    label: '▭ Shape',    title: 'Filled rectangle' },
  { id: 'whiteout', label: '⬜ Whiteout', title: 'White rectangle (mask)' },
];

const DEFAULT_SIZES = {
  text:     { w: 200, h: 28 },   // in PDF points (placeholder width)
  sign:     { w: 200, h: 36 },
  link:     { w: 120, h: 24 },
  image:    { w: 120, h: 90 },
  shape:    { w: 100, h: 60 },
  whiteout: { w: 120, h: 24 },
};

const DRAG_THRESHOLD = 4;          // pixels before a click is treated as a drag
const HANDLE_SIZE_PX = 10;
const MIN_SIZE = 6;                // minimum annotation size in points

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
  };
};

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const dataUrlToBytes = (dataUrl) => {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);
  const binary = isBase64 ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const toNum = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

const fontFamilyCss = (f) =>
  f === 'TimesRoman' ? '"Times New Roman", Times, serif'
  : f === 'Courier'  ? 'Courier, monospace'
  : 'Arial, Helvetica, sans-serif';

/* Load an image to get natural dimensions for aspect ratio */
const measureImage = (dataUrl) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = rej;
    img.src = dataUrl;
  });

/* -------------------------------------------------------------------------- */
/*  Fairy lights (only on success screen)                                     */
/* -------------------------------------------------------------------------- */

const FairyLights = () => {
  const lights = useMemo(() => {
    const colors = ['#ff3b30', '#00bcd4', '#34c759', '#ffcc00', '#ff007f'];
    const out = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 18; i++) {
        const color = colors[(i + row * 2) % colors.length];
        const rotation = -15 + Math.random() * 30;
        out.push({
          key: `${row}-${i}`, color,
          side: row === 0 ? 'top' : 'bottom',
          rotation: row === 0 ? rotation : rotation + 180,
          left: 4 + i * 5.4,
          delay: Math.random() * 2,
          duration: 0.8 + Math.random(),
        });
      }
    }
    return out;
  }, []);

  return (
    <>
      <div className="fairy-wire top" />
      <div className="fairy-wire bottom" />
      {lights.map((l) => (
        <div key={l.key} className="fairy-light" style={{
          backgroundColor: l.color,
          [l.side]: '18px',
          left: `${l.left}%`,
          transform: l.side === 'top'
            ? `rotate(${l.rotation}deg)`
            : `rotate(${l.rotation}deg) rotateX(180deg)`,
          animationDelay: `${l.delay}s`,
          animationDuration: `${l.duration}s`,
          boxShadow: `0 0 12px ${l.color}, 0 0 4px ${l.color}`,
        }} />
      ))}
    </>
  );
};

/* ========================================================================== */
/*  Main component                                                            */
/* ========================================================================== */

export default function EditPdf() {
  // File / processing
  const [file, setFile] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  // pdfjs / page rendering
  const [pdfjsLib, setPdfjsLib] = useState(null);
  const [pdfRenderDoc, setPdfRenderDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 }); // in points
  const [scale, setScale] = useState(1.4);
  const [thumbs, setThumbs] = useState([]); // [{ pageNumber, dataUrl }]

  // Annotations + history
  const [annotations, setAnnotations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const historyRef = useRef([[]]);
  const historyIndexRef = useRef(0);

  // Tool / defaults
  const [activeTool, setActiveTool] = useState('select');
  const [defaults, setDefaults] = useState({
    color: '#ff0000',
    fontSize: 18,
    fontFamily: 'Helvetica',
  });

  // Pending image for image tool (chosen via file picker first)
  const pendingImageRef = useRef(null);

  // Pointer state (held in refs to avoid re-renders during drag)
  const pointerRef = useRef({
    mode: null,            // 'create' | 'move' | 'resize' | null
    startScreen: null,     // { x, y } in canvas pixels
    startAnn: null,        // snapshot of annotation at gesture start
    handle: null,          // 'tl','tr','bl','br','t','b','l','r'
    moved: false,
  });
  const [previewBox, setPreviewBox] = useState(null);  // for drag-to-create live rect (px)
  const [editingTextId, setEditingTextId] = useState(null);

  // Refs
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const fileInputRef = useRef(null);
  const renderTaskRef = useRef(null);
  const downloadUrlRef = useRef(null);

  /* ===================================================================== */
  /*  pdfjs                                                                 */
  /* ===================================================================== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        if (!cancelled) setPdfjsLib(pdfjs);
      } catch (err) {
        console.error('Failed to load pdfjs', err);
        if (!cancelled) setError('Failed to load PDF viewer.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!pdfData || !pdfjsLib) return;
    let cancelled = false;
    let docRef = null;
    (async () => {
      try {
        const bytes = new Uint8Array(pdfData.slice(0));
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) { doc.destroy?.(); return; }
        docRef = doc;
        setPdfRenderDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage((p) => clamp(p, 1, doc.numPages));
        // generate thumbnails
        const ts = [];
        for (let i = 1; i <= doc.numPages; i++) {
          try {
            const page = await doc.getPage(i);
            const vp = page.getViewport({ scale: 0.2 });
            const cvs = document.createElement('canvas');
            cvs.width = vp.width; cvs.height = vp.height;
            await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
            ts.push({ pageNumber: i, dataUrl: cvs.toDataURL() });
            if (cancelled) return;
            setThumbs([...ts]);
          } catch (e) {
            console.warn('thumb render fail', e);
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load PDF.');
      }
    })();
    return () => { cancelled = true; docRef?.destroy?.(); };
  }, [pdfData, pdfjsLib]);

  /* ===================================================================== */
  /*  Render current page                                                   */
  /* ===================================================================== */
  useEffect(() => {
    if (!pdfRenderDoc || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} }
        const page = await pdfRenderDoc.getPage(currentPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const baseViewport = page.getViewport({ scale: 1 });
        setPageSize({ width: baseViewport.width, height: baseViewport.height });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') console.error('Render error', err);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfRenderDoc, currentPage, scale]);

  /* ===================================================================== */
  /*  Object URL cleanup                                                    */
  /* ===================================================================== */
  useEffect(() => () => {
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
  }, []);

  /* ===================================================================== */
  /*  History                                                               */
  /* ===================================================================== */
  const pushHistory = useCallback((next) => {
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    history.push(next);
    if (history.length > 100) history.shift();
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
  }, []);

  const commit = useCallback((updater) => {
    setAnnotations((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setAnnotations(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setAnnotations(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
  }, []);

  /* ===================================================================== */
  /*  Keyboard                                                              */
  /* ===================================================================== */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || tag === 'select';
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        if (inField) return;
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        if (inField) return;
        e.preventDefault();
        redo();
        return;
      }
      if (!selectedId || inField) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        commit((prev) => prev.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingTextId(null);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        commit((prev) => prev.map((a) => {
          if (a.id !== selectedId) return a;
          let { x, y } = a;
          if (e.key === 'ArrowUp') y -= step;
          if (e.key === 'ArrowDown') y += step;
          if (e.key === 'ArrowLeft') x -= step;
          if (e.key === 'ArrowRight') x += step;
          return {
            ...a,
            x: clamp(x, 0, pageSize.width - a.width),
            y: clamp(y, 0, pageSize.height - a.height),
          };
        }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, commit, undo, redo, pageSize]);

  /* ===================================================================== */
  /*  File loading                                                          */
  /* ===================================================================== */
  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') { setError('Please select a valid PDF file.'); return; }

    setFile(selected);
    setError(null);
    setIsComplete(false);
    setAnnotations([]);
    historyRef.current = [[]];
    historyIndexRef.current = 0;
    setSelectedId(null);
    setEditingTextId(null);
    setCurrentPage(1);
    setThumbs([]);
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
      setDownloadUrl(null);
    }

    try {
      const arrayBuffer = await selected.arrayBuffer();
      setPdfData(arrayBuffer);
    } catch (err) {
      console.error(err);
      setError('Failed to read the PDF file.');
    }
  };

  /* ===================================================================== */
  /*  Coord conversion                                                      */
  /* ===================================================================== */
  const screenToPdf = useCallback((sx, sy) => ({ x: sx / scale, y: sy / scale }), [scale]);
  const ptsToPx = useCallback((n) => n * scale, [scale]);

  /* ===================================================================== */
  /*  Creating annotations                                                  */
  /* ===================================================================== */
  const createAnnotationAt = useCallback(async (rectPdf, kind, opts = {}) => {
    const id = newId();
    const base = { id, pageIndex: currentPage, ...rectPdf };

    if (kind === 'text') {
      const ann = {
        ...base, type: 'text', text: '',
        color: defaults.color, fontSize: defaults.fontSize, fontFamily: defaults.fontFamily,
      };
      commit((prev) => [...prev, ann]);
      setSelectedId(id);
      setEditingTextId(id);
      return;
    }
    if (kind === 'sign') {
      const name = window.prompt('Type your signature:', 'Your Name');
      if (!name) return;
      const ann = {
        ...base, type: 'text', text: name,
        color: '#09090b', fontSize: Math.max(20, defaults.fontSize * 1.2), fontFamily: 'TimesRoman',
      };
      commit((prev) => [...prev, ann]);
      setSelectedId(id);
      return;
    }
    if (kind === 'link') {
      const url = window.prompt('Enter URL:', 'https://');
      if (!url) return;
      const ann = { ...base, type: 'link', url };
      commit((prev) => [...prev, ann]);
      setSelectedId(id);
      return;
    }
    if (kind === 'image') {
      const img = opts.image || pendingImageRef.current;
      if (!img) return;
      // adjust aspect ratio if the user didn't drag (default size)
      let { x, y, width, height } = base;
      if (opts.fromClick) {
        const ratio = img.naturalW / img.naturalH || 1;
        width = DEFAULT_SIZES.image.w;
        height = width / ratio;
      }
      const ann = {
        ...base, x, y, width, height, type: 'image', dataUrl: img.dataUrl,
        naturalW: img.naturalW, naturalH: img.naturalH,
      };
      commit((prev) => [...prev, ann]);
      setSelectedId(id);
      pendingImageRef.current = null;
      setActiveTool('select');
      return;
    }
    if (kind === 'shape') {
      const ann = { ...base, type: 'shape', color: defaults.color };
      commit((prev) => [...prev, ann]);
      setSelectedId(id);
      return;
    }
    if (kind === 'whiteout') {
      const ann = { ...base, type: 'whiteout' };
      commit((prev) => [...prev, ann]);
      setSelectedId(id);
      return;
    }
  }, [currentPage, defaults, commit]);

  /* ===================================================================== */
  /*  Pointer handlers (overlay)                                            */
  /* ===================================================================== */
  const getPointer = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onOverlayPointerDown = (e) => {
    if (e.button !== 0) return;
    const target = e.target;
    // Clicks on annotation chrome are handled by the annotation itself
    if (target.closest('[data-annot]') || target.closest('[data-handle]')) return;

    const pt = getPointer(e);
    if (activeTool === 'select') {
      setSelectedId(null);
      setEditingTextId(null);
      return;
    }

    pointerRef.current = {
      mode: 'create',
      startScreen: pt,
      moved: false,
      tool: activeTool,
    };
    setPreviewBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
    overlayRef.current.setPointerCapture?.(e.pointerId);
  };

  const onOverlayPointerMove = (e) => {
    const state = pointerRef.current;
    if (!state.mode) return;
    const pt = getPointer(e);

    if (state.mode === 'create') {
      const dx = pt.x - state.startScreen.x;
      const dy = pt.y - state.startScreen.y;
      if (!state.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) state.moved = true;
      if (state.moved) {
        const x = Math.min(pt.x, state.startScreen.x);
        const y = Math.min(pt.y, state.startScreen.y);
        const w = Math.abs(dx);
        const h = Math.abs(dy);
        setPreviewBox({ x, y, w, h });
      }
      return;
    }

    if (state.mode === 'move') {
      const dxPts = (pt.x - state.startScreen.x) / scale;
      const dyPts = (pt.y - state.startScreen.y) / scale;
      const start = state.startAnn;
      setAnnotations((prev) => prev.map((a) => {
        if (a.id !== start.id) return a;
        return {
          ...a,
          x: clamp(start.x + dxPts, 0, pageSize.width - a.width),
          y: clamp(start.y + dyPts, 0, pageSize.height - a.height),
        };
      }));
      return;
    }

    if (state.mode === 'resize') {
      const dxPts = (pt.x - state.startScreen.x) / scale;
      const dyPts = (pt.y - state.startScreen.y) / scale;
      const start = state.startAnn;
      const keepRatio = e.shiftKey || start.type === 'image';
      const ratio = start.width / Math.max(1, start.height);

      let x = start.x, y = start.y, w = start.width, h = start.height;
      const h_ = state.handle;
      if (h_.includes('r')) w = Math.max(MIN_SIZE, start.width + dxPts);
      if (h_.includes('l')) { w = Math.max(MIN_SIZE, start.width - dxPts); x = start.x + (start.width - w); }
      if (h_.includes('b')) h = Math.max(MIN_SIZE, start.height + dyPts);
      if (h_.includes('t')) { h = Math.max(MIN_SIZE, start.height - dyPts); y = start.y + (start.height - h); }

      if (keepRatio && (h_ === 'tl' || h_ === 'tr' || h_ === 'bl' || h_ === 'br')) {
        // Lock to the dimension with the greater change
        const wRatio = w / start.width;
        const hRatio = h / start.height;
        const chosen = Math.abs(wRatio - 1) > Math.abs(hRatio - 1) ? 'w' : 'h';
        if (chosen === 'w') {
          h = w / ratio;
          if (h_.includes('t')) y = start.y + start.height - h;
        } else {
          w = h * ratio;
          if (h_.includes('l')) x = start.x + start.width - w;
        }
      }

      // page clamp
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { h += y; y = 0; }
      if (x + w > pageSize.width)  w = pageSize.width  - x;
      if (y + h > pageSize.height) h = pageSize.height - y;

      setAnnotations((prev) => prev.map((a) =>
        a.id === start.id ? { ...a, x, y, width: w, height: h } : a
      ));
    }
  };

  const onOverlayPointerUp = (e) => {
    const state = pointerRef.current;
    if (!state.mode) return;
    overlayRef.current.releasePointerCapture?.(e.pointerId);

    if (state.mode === 'create') {
      const tool = state.tool;
      const pt = getPointer(e);
      const drewBox = state.moved;
      let rectPdf;
      if (drewBox) {
        const x = Math.min(pt.x, state.startScreen.x);
        const y = Math.min(pt.y, state.startScreen.y);
        const w = Math.max(MIN_SIZE * scale, Math.abs(pt.x - state.startScreen.x));
        const h = Math.max(MIN_SIZE * scale, Math.abs(pt.y - state.startScreen.y));
        rectPdf = {
          x: x / scale, y: y / scale,
          width: w / scale, height: h / scale,
        };
      } else {
        const def = DEFAULT_SIZES[tool] || DEFAULT_SIZES.shape;
        rectPdf = {
          x: pt.x / scale, y: pt.y / scale,
          width: def.w, height: def.h,
        };
      }
      // clamp to page
      rectPdf.x = clamp(rectPdf.x, 0, Math.max(0, pageSize.width - rectPdf.width));
      rectPdf.y = clamp(rectPdf.y, 0, Math.max(0, pageSize.height - rectPdf.height));

      if (tool === 'image') {
        // open file picker if no image staged
        if (!pendingImageRef.current) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/png, image/jpeg';
          input.onchange = async (ev) => {
            const f = ev.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = async () => {
              try {
                const { w, h } = await measureImage(reader.result);
                pendingImageRef.current = { dataUrl: reader.result, naturalW: w, naturalH: h };
                // If user dragged a box, place at that rect (cropped to ratio if not too off)
                // otherwise default placement
                await createAnnotationAt(rectPdf, 'image', {
                  image: pendingImageRef.current,
                  fromClick: !drewBox,
                });
              } catch (err) {
                console.error(err);
                setError('Failed to load image.');
              }
            };
            reader.readAsDataURL(f);
          };
          input.click();
        } else {
          createAnnotationAt(rectPdf, 'image', {
            image: pendingImageRef.current, fromClick: !drewBox,
          });
        }
      } else {
        createAnnotationAt(rectPdf, tool);
      }
      setPreviewBox(null);
    } else if (state.mode === 'move' || state.mode === 'resize') {
      // commit to history (state already has the final position)
      setAnnotations((prev) => { pushHistory(prev); return prev; });
    }

    pointerRef.current = { mode: null, startScreen: null, startAnn: null, handle: null, moved: false };
  };

  /* ===================================================================== */
  /*  Annotation pointer (move / select)                                    */
  /* ===================================================================== */
  const onAnnotPointerDown = (id, e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(id);
    // Clicking an existing annotation always lets you move it,
    // regardless of which creation tool is active.
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    if (editingTextId === id) return;
    const pt = getPointer(e);
    pointerRef.current = {
      mode: 'move',
      startScreen: pt,
      startAnn: { ...ann },
      moved: false,
    };
    overlayRef.current.setPointerCapture?.(e.pointerId);
  };

  const onHandlePointerDown = (id, handle, e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(id);
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    const pt = getPointer(e);
    pointerRef.current = {
      mode: 'resize',
      startScreen: pt,
      startAnn: { ...ann },
      handle,
      moved: false,
    };
    overlayRef.current.setPointerCapture?.(e.pointerId);
  };

  /* ===================================================================== */
  /*  Annotation editing API                                                */
  /* ===================================================================== */
  const updateSelected = useCallback((patch) => {
    if (!selectedId) return;
    commit((prev) => prev.map((a) => a.id === selectedId ? { ...a, ...patch } : a));
  }, [selectedId, commit]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, commit]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    const ann = annotations.find((a) => a.id === selectedId);
    if (!ann) return;
    const copy = { ...ann, id: newId(), x: ann.x + 10, y: ann.y + 10 };
    commit((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }, [selectedId, annotations, commit]);

  /* ===================================================================== */
  /*  Save                                                                  */
  /* ===================================================================== */
  const handleSavePdf = async () => {
    if (!pdfData) return;
    setIsProcessing(true);
    setError(null);
    try {
      const pdfDoc = await PDFDocument.load(pdfData.slice(0));
      const pages = pdfDoc.getPages();

      const usedFonts = new Set(
        annotations.filter((a) => a.type === 'text').map((a) => a.fontFamily || 'Helvetica')
      );
      const fonts = {};
      for (const name of usedFonts) {
        const std = StandardFonts[name] || StandardFonts.Helvetica;
        fonts[name] = await pdfDoc.embedFont(std);
      }
      if (!fonts.Helvetica) fonts.Helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const ann of annotations) {
        if (ann.pageIndex < 1 || ann.pageIndex > pages.length) continue;
        const page = pages[ann.pageIndex - 1];
        const ph = page.getHeight();
        const x = ann.x;
        const yTop = ann.y;
        const w = ann.width;
        const h = ann.height;
        const yBottom = ph - yTop - h; // pdf-lib origin

        if (ann.type === 'text') {
          const { r, g, b } = hexToRgb(ann.color);
          const font = fonts[ann.fontFamily] || fonts.Helvetica;
          const size = ann.fontSize;
          // baseline ≈ top + ascent ≈ top + size * 0.8
          page.drawText(ann.text || '', {
            x,
            y: ph - yTop - size * 0.85,
            size,
            color: rgb(r, g, b),
            font,
          });
        } else if (ann.type === 'link') {
          const linkAnnot = pdfDoc.context.register(
            pdfDoc.context.obj({
              Type: 'Annot',
              Subtype: 'Link',
              Rect: [x, yBottom, x + w, yBottom + h],
              Border: [0, 0, 0],
              A: { Type: 'Action', S: 'URI', URI: PDFString.of(ann.url) },
            })
          );
          const existing = page.node.get(PDFName.of('Annots'));
          let merged;
          if (existing) {
            const resolved = pdfDoc.context.lookup(existing);
            merged = resolved instanceof PDFArray
              ? pdfDoc.context.newArray([...resolved.asArray(), linkAnnot])
              : pdfDoc.context.newArray([linkAnnot]);
          } else {
            merged = pdfDoc.context.newArray([linkAnnot]);
          }
          page.node.set(PDFName.of('Annots'), merged);
        } else if (ann.type === 'image') {
          const bytes = dataUrlToBytes(ann.dataUrl);
          const isPng = /^data:image\/png/i.test(ann.dataUrl);
          const embedded = isPng
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);
          page.drawImage(embedded, { x, y: yBottom, width: w, height: h });
        } else if (ann.type === 'whiteout') {
          page.drawRectangle({ x, y: yBottom, width: w, height: h, color: rgb(1, 1, 1) });
        } else if (ann.type === 'shape') {
          const { r, g, b } = hexToRgb(ann.color);
          page.drawRectangle({ x, y: yBottom, width: w, height: h, color: rgb(r, g, b) });
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      const url = URL.createObjectURL(blob);
      downloadUrlRef.current = url;
      setDownloadUrl(url);
      setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError('Failed to generate final PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  /* ===================================================================== */
  /*  Computed                                                              */
  /* ===================================================================== */
  const visibleAnnotations = useMemo(
    () => annotations.filter((a) => a.pageIndex === currentPage),
    [annotations, currentPage]
  );
  const selected = useMemo(
    () => annotations.find((a) => a.id === selectedId) || null,
    [annotations, selectedId]
  );

  /* ===================================================================== */
  /*  Render                                                                */
  /* ===================================================================== */

  if (isComplete) {
    return (
      <div className="tool-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Link href="/tools/pdf" className="tool-page-back" style={{ margin: '10px 20px' }}>← Back to PDF Toolkit</Link>
        <div className="result-container pe-success">
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#ffcc00', marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000' }}>
            DOCUMENT SAVED!
          </h2>
          <div style={{ color: '#fff', marginBottom: '30px', fontSize: '1.2rem' }}>
            All annotations have been stamped successfully.
          </div>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setIsComplete(false)}>Continue Editing</button>
            <a
              href={downloadUrl}
              download={`edited_${file?.name || 'document.pdf'}`}
              className="btn btn-primary"
              style={{ background: 'var(--pixel-green)', textDecoration: 'none', display: 'inline-block' }}
            >
              ⬇️ Download PDF
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="tool-page">
        <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
        <div className="tool-page-header">
          <h1>🖍️ Edit PDF</h1>
          <p>Add text, signatures, links, images, shapes and whiteouts — production-grade visual editor.</p>
        </div>
        <div className="result-container" style={{ padding: '20px' }}>
          {error && <div className="error-message">⚠️ {error}</div>}
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-zone-icon">🖍️</div>
            <div className="upload-zone-text">Click or drag a PDF here to start editing</div>
            <input
              type="file" ref={fileInputRef} onChange={handleFileChange}
              accept="application/pdf" style={{ display: 'none' }}
            />
          </div>
          {!pdfjsLib && (
            <div style={{ textAlign: 'center', color: '#aaa', fontSize: '0.75rem', fontFamily: 'var(--font-pixel)' }}>
              Loading PDF engine…
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Editor view */
  const canvasWPx = pageSize.width  * scale;
  const canvasHPx = pageSize.height * scale;

  return (
    <div className="tool-page pe-root">
      {/* Top bar */}
      <div className="pe-topbar">
        <Link href="/tools/pdf" className="tool-page-back" style={{ margin: 0 }}>← Back</Link>
        <div className="pe-file-name" title={file.name}>📄 {file.name}</div>

        <div className="pe-toolbar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              title={t.title}
              className={`btn ${activeTool === t.id ? 'btn-selected' : 'btn-ghost'}`}
              onClick={() => { setActiveTool(t.id); pendingImageRef.current = null; }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="pe-spacer" />

        <div className="pe-group">
          <button className="btn btn-ghost" onClick={undo} title="Undo (Ctrl/Cmd+Z)">↶</button>
          <button className="btn btn-ghost" onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z)">↷</button>
        </div>

        <div className="pe-group">
          <button className="btn btn-ghost" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))}>−</button>
          <span className="pe-zoom">{Math.round(scale * 100)}%</span>
          <button className="btn btn-ghost" onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))}>+</button>
        </div>

        <button
          className="btn btn-primary pe-save"
          onClick={handleSavePdf}
          disabled={isProcessing || !pdfData}
        >
          {isProcessing ? 'SAVING…' : '💾 SAVE PDF'}
        </button>
      </div>

      {error && <div className="pe-error">⚠️ {error}</div>}

      <div className="pe-body">
        {/* Thumbnails sidebar */}
        <aside className="pe-thumbs">
          {Array.from({ length: totalPages }).map((_, i) => {
            const pageNumber = i + 1;
            const t = thumbs.find((x) => x.pageNumber === pageNumber);
            const count = annotations.filter((a) => a.pageIndex === pageNumber).length;
            return (
              <button
                key={pageNumber}
                className={`pe-thumb ${pageNumber === currentPage ? 'is-current' : ''}`}
                onClick={() => setCurrentPage(pageNumber)}
                title={`Page ${pageNumber}`}
              >
                {t ? (
                  <img src={t.dataUrl} alt={`Page ${pageNumber}`} />
                ) : (
                  <div className="pe-thumb-placeholder" />
                )}
                <span className="pe-thumb-label">
                  {pageNumber}{count > 0 ? ` • ${count}` : ''}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Canvas area */}
        <main className="pe-canvas-area">
          <div className="pe-canvas-wrap" style={{ width: canvasWPx, height: canvasHPx }}>
            <canvas ref={canvasRef} className="pe-canvas" />
            <div
              ref={overlayRef}
              className="pe-overlay"
              data-tool={activeTool}
              onPointerDown={onOverlayPointerDown}
              onPointerMove={onOverlayPointerMove}
              onPointerUp={onOverlayPointerUp}
              onPointerCancel={onOverlayPointerUp}
              style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
            >
              {visibleAnnotations.map((ann) => (
                <AnnotationBox
                  key={ann.id}
                  ann={ann}
                  scale={scale}
                  isSelected={selectedId === ann.id}
                  isEditing={editingTextId === ann.id}
                  onPointerDown={(e) => onAnnotPointerDown(ann.id, e)}
                  onHandlePointerDown={(handle, e) => onHandlePointerDown(ann.id, handle, e)}
                  onTextChange={(text) => setAnnotations((prev) =>
                    prev.map((a) => a.id === ann.id ? { ...a, text } : a))}
                  onTextCommit={() => {
                    setEditingTextId(null);
                    setAnnotations((prev) => { pushHistory(prev); return prev; });
                  }}
                  onDoubleClick={() => { if (ann.type === 'text') setEditingTextId(ann.id); }}
                />
              ))}
              {previewBox && (
                <div className="pe-preview-box"
                  style={{ left: previewBox.x, top: previewBox.y, width: previewBox.w, height: previewBox.h }}
                />
              )}
            </div>
          </div>
        </main>

        {/* Properties panel */}
        <aside className="pe-props">
          <div className="pe-props-header">Properties</div>
          {!selected ? (
            <div className="pe-props-empty">
              <div style={{ fontSize: '1.4rem', marginBottom: '10px' }}>💡</div>
              <div>Select an item to edit its properties, or pick a tool above to add something new.</div>
              <ul className="pe-tips">
                <li><b>Drag</b> on the page to draw at a custom size</li>
                <li><b>Click</b> to drop at default size</li>
                <li><b>Shift+drag</b> a corner to keep aspect ratio</li>
                <li><b>Arrows</b> nudge, <b>Shift+Arrows</b> move by 10</li>
                <li><b>Del</b> remove · <b>Esc</b> deselect</li>
                <li><b>Ctrl/Cmd+Z</b> undo · <b>Shift</b> for redo</li>
              </ul>
            </div>
          ) : (
            <PropertiesPanel
              ann={selected}
              onChange={updateSelected}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
            />
          )}
        </aside>
      </div>

      <style jsx>{`
        .pe-root { height: 100vh; display: flex; flex-direction: column; padding: 0 !important; }
        .pe-topbar {
          display: flex; align-items: center; gap: 10px; padding: 8px 14px;
          background: #1a1a1a; border-bottom: 3px solid var(--pixel-border);
          flex-wrap: wrap;
        }
        .pe-file-name {
          font-family: var(--font-pixel); font-size: 0.7rem; color: var(--pixel-cyan);
          max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pe-toolbar { display: flex; gap: 4px; flex-wrap: wrap; }
        .pe-toolbar .btn { padding: 6px 10px !important; font-size: 0.7rem !important; }
        .pe-group {
          display: flex; align-items: center; gap: 4px;
          padding-left: 12px; border-left: 2px solid #333;
        }
        .pe-group .btn { padding: 6px 10px !important; font-size: 0.7rem !important; }
        .pe-zoom {
          font-family: var(--font-pixel); font-size: 0.7rem; color: #fff;
          min-width: 48px; text-align: center;
        }
        .pe-spacer { flex: 1 }
        .pe-save { padding: 8px 14px !important; font-size: 0.75rem !important; }

        .pe-error {
          background: #f44336; color: #fff; padding: 8px;
          text-align: center; font-family: var(--font-pixel); font-size: 0.75rem;
        }

        .pe-body { flex: 1; display: flex; min-height: 0; }
        .pe-thumbs {
          width: 130px; flex-shrink: 0; background: #0d0d0d;
          border-right: 3px solid var(--pixel-border);
          overflow-y: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 10px;
        }
        .pe-thumb {
          background: #1a1a1a; border: 2px solid #333; padding: 4px;
          cursor: pointer; position: relative; transition: all .12s;
          display: flex; flex-direction: column; align-items: center;
        }
        .pe-thumb:hover { border-color: var(--pixel-cyan); }
        .pe-thumb.is-current { border-color: var(--pixel-yellow); box-shadow: 0 0 12px rgba(255,235,59,0.4); }
        .pe-thumb img { width: 100%; display: block; background: #fff; }
        .pe-thumb-placeholder { width: 100%; aspect-ratio: 0.77; background: #222; }
        .pe-thumb-label {
          font-family: var(--font-pixel); font-size: 0.55rem; color: #ccc; margin-top: 4px;
        }

        .pe-canvas-area {
          flex: 1; overflow: auto; background: #2a2a2a; padding: 30px;
          display: flex; justify-content: center; align-items: flex-start;
        }
        .pe-canvas-wrap {
          position: relative; box-shadow: 0 0 30px rgba(0,0,0,0.7);
          background: #fff;
        }
        .pe-canvas { display: block; }
        .pe-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          user-select: none;
        }
        .pe-overlay[data-tool="text"] { cursor: text; }
        .pe-preview-box {
          position: absolute; border: 2px dashed var(--pixel-cyan);
          background: rgba(0,188,212,0.1); pointer-events: none;
        }

        .pe-props {
          width: 270px; flex-shrink: 0; background: #181818;
          border-left: 3px solid var(--pixel-border);
          overflow-y: auto;
        }
        .pe-props-header {
          font-family: var(--font-pixel); font-size: 0.8rem; color: var(--pixel-yellow);
          padding: 12px; border-bottom: 2px solid #333;
        }
        .pe-props-empty {
          padding: 16px; color: #aaa; font-size: 0.85rem; line-height: 1.5;
        }
        .pe-tips {
          margin-top: 14px; padding-left: 16px; color: #888; font-size: 0.78rem; line-height: 1.6;
        }
        .pe-tips b { color: var(--pixel-cyan); }
        .pe-success {
          margin: auto; max-width: 800px; position: relative; text-align: center;
          padding: 60px 20px; background: #2d1b4e; border: 4px solid #ff007f;
          box-shadow: 0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}

/* ========================================================================== */
/*  Annotation visual                                                         */
/* ========================================================================== */

function AnnotationBox({
  ann, scale, isSelected, isEditing,
  onPointerDown, onHandlePointerDown,
  onTextChange, onTextCommit, onDoubleClick,
}) {
  const left   = ann.x * scale;
  const top    = ann.y * scale;
  const width  = ann.width * scale;
  const height = ann.height * scale;

  const base = {
    position: 'absolute',
    left, top, width, height,
    boxSizing: 'border-box',
  };

  let inner = null;

  if (ann.type === 'text') {
    const fontPx = ann.fontSize * scale;
    const style = {
      ...base,
      display: 'flex', alignItems: 'flex-start',
      border: isSelected ? '1px dashed var(--pixel-cyan)' : '1px dashed transparent',
      background: isSelected ? 'rgba(0,188,212,0.06)' : 'transparent',
      cursor: isEditing ? 'text' : 'move',
      padding: 0,
    };
    inner = (
      <div
        data-annot={ann.id}
        style={style}
        onPointerDown={isEditing ? undefined : onPointerDown}
        onDoubleClick={onDoubleClick}
      >
        {isEditing ? (
          <textarea
            autoFocus
            value={ann.text}
            onChange={(e) => onTextChange(e.target.value)}
            onBlur={onTextCommit}
            onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}
            style={{
              width: '100%', height: '100%', resize: 'none',
              background: 'transparent', border: 'none', outline: 'none',
              color: ann.color, fontSize: `${fontPx}px`,
              fontFamily: fontFamilyCss(ann.fontFamily),
              padding: 0, margin: 0, lineHeight: 1.15,
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            color: ann.color, fontSize: `${fontPx}px`,
            fontFamily: fontFamilyCss(ann.fontFamily),
            lineHeight: 1.15, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            overflow: 'hidden',
          }}>
            {ann.text || <span style={{ color: 'rgba(0,120,255,0.5)' }}>Type text…</span>}
          </div>
        )}
      </div>
    );
  } else if (ann.type === 'link') {
    inner = (
      <div
        data-annot={ann.id}
        onPointerDown={onPointerDown}
        style={{
          ...base,
          background: 'rgba(0, 120, 255, 0.18)',
          border: '2px dashed #0070f3',
          display: 'flex', alignItems: 'center',
          padding: '0 6px', cursor: 'move',
          overflow: 'hidden',
        }}
      >
        <span style={{
          fontSize: '11px', color: '#0070f3', fontFamily: 'sans-serif',
          whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%',
        }}>
          🔗 {ann.url}
        </span>
      </div>
    );
  } else if (ann.type === 'image') {
    inner = (
      <div
        data-annot={ann.id}
        onPointerDown={onPointerDown}
        style={{
          ...base,
          border: isSelected ? '1px solid var(--pixel-cyan)' : '1px solid rgba(0,0,0,0.2)',
          cursor: 'move', overflow: 'hidden', background: '#fff',
        }}
      >
        <img
          src={ann.dataUrl}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }}
        />
      </div>
    );
  } else if (ann.type === 'whiteout') {
    inner = (
      <div
        data-annot={ann.id}
        onPointerDown={onPointerDown}
        style={{
          ...base,
          background: '#ffffff',
          border: isSelected ? '1px dashed var(--pixel-cyan)' : '1px dashed rgba(0,0,0,0.15)',
          cursor: 'move',
        }}
      />
    );
  } else if (ann.type === 'shape') {
    inner = (
      <div
        data-annot={ann.id}
        onPointerDown={onPointerDown}
        style={{
          ...base,
          background: ann.color,
          border: isSelected ? '1px solid var(--pixel-cyan)' : '1px solid rgba(0,0,0,0.2)',
          cursor: 'move',
        }}
      />
    );
  }

  return (
    <>
      {inner}
      {isSelected && <ResizeHandles ann={ann} scale={scale} onPointerDown={onHandlePointerDown} />}
    </>
  );
}

function ResizeHandles({ ann, scale, onPointerDown }) {
  const left   = ann.x * scale;
  const top    = ann.y * scale;
  const width  = ann.width * scale;
  const height = ann.height * scale;
  const s = HANDLE_SIZE_PX;
  const handles = [
    { id: 'tl', x: left - s/2,            y: top - s/2,             cur: 'nwse-resize' },
    { id: 'tr', x: left + width - s/2,    y: top - s/2,             cur: 'nesw-resize' },
    { id: 'bl', x: left - s/2,            y: top + height - s/2,    cur: 'nesw-resize' },
    { id: 'br', x: left + width - s/2,    y: top + height - s/2,    cur: 'nwse-resize' },
    { id: 't',  x: left + width/2 - s/2,  y: top - s/2,             cur: 'ns-resize' },
    { id: 'b',  x: left + width/2 - s/2,  y: top + height - s/2,    cur: 'ns-resize' },
    { id: 'l',  x: left - s/2,            y: top + height/2 - s/2,  cur: 'ew-resize' },
    { id: 'r',  x: left + width - s/2,    y: top + height/2 - s/2,  cur: 'ew-resize' },
  ];
  return (
    <>
      {handles.map((h) => (
        <div
          key={h.id}
          data-handle={h.id}
          onPointerDown={(e) => onPointerDown(h.id, e)}
          style={{
            position: 'absolute', left: h.x, top: h.y, width: s, height: s,
            background: '#fff', border: '2px solid var(--pixel-cyan)',
            cursor: h.cur, zIndex: 100, boxSizing: 'border-box',
          }}
        />
      ))}
    </>
  );
}

/* ========================================================================== */
/*  Properties panel                                                          */
/* ========================================================================== */

function PropertiesPanel({ ann, onChange, onDelete, onDuplicate }) {
  const row = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' };
  const label = { fontFamily: 'var(--font-pixel)', fontSize: '0.6rem', color: '#aaa', minWidth: '60px' };
  const inp = { flex: 1, padding: '5px 6px', border: '2px solid #333', background: '#222', color: '#fff', fontSize: '0.8rem' };
  const numInp = { ...inp, flex: 0, width: '80px' };

  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: 'var(--pixel-cyan)', marginBottom: '12px' }}>
        {ann.type.toUpperCase()}
      </div>

      {/* Type-specific */}
      {ann.type === 'text' && (
        <>
          <div style={row}>
            <label style={label}>Text</label>
            <textarea
              value={ann.text}
              onChange={(e) => onChange({ text: e.target.value })}
              style={{ ...inp, minHeight: 60, resize: 'vertical' }}
            />
          </div>
          <div style={row}>
            <label style={label}>Font</label>
            <select value={ann.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })} style={inp}>
              <option value="Helvetica">Helvetica</option>
              <option value="TimesRoman">Times Roman</option>
              <option value="Courier">Courier</option>
            </select>
          </div>
          <div style={row}>
            <label style={label}>Size</label>
            <input type="number" min={6} max={300} value={ann.fontSize}
              onChange={(e) => onChange({ fontSize: Math.max(6, toNum(e.target.value, ann.fontSize)) })}
              style={numInp} />
            <span style={{ fontSize: '0.7rem', color: '#888' }}>pt</span>
          </div>
          <div style={row}>
            <label style={label}>Color</label>
            <input type="color" value={ann.color} onChange={(e) => onChange({ color: e.target.value })}
              style={{ width: 40, height: 30, padding: 0, border: '2px solid #333', background: 'transparent' }} />
          </div>
        </>
      )}

      {ann.type === 'shape' && (
        <div style={row}>
          <label style={label}>Color</label>
          <input type="color" value={ann.color} onChange={(e) => onChange({ color: e.target.value })}
            style={{ width: 40, height: 30, padding: 0, border: '2px solid #333', background: 'transparent' }} />
        </div>
      )}

      {ann.type === 'link' && (
        <div style={row}>
          <label style={label}>URL</label>
          <input type="text" value={ann.url} onChange={(e) => onChange({ url: e.target.value })} style={inp} />
        </div>
      )}

      {/* Position / size — common */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #333' }}>
        <div style={row}>
          <label style={label}>X</label>
          <input type="number" value={Math.round(ann.x)}
            onChange={(e) => onChange({ x: toNum(e.target.value, ann.x) })} style={numInp} />
          <label style={label}>Y</label>
          <input type="number" value={Math.round(ann.y)}
            onChange={(e) => onChange({ y: toNum(e.target.value, ann.y) })} style={numInp} />
        </div>
        <div style={row}>
          <label style={label}>W</label>
          <input type="number" min={MIN_SIZE} value={Math.round(ann.width)}
            onChange={(e) => onChange({ width: Math.max(MIN_SIZE, toNum(e.target.value, ann.width)) })} style={numInp} />
          <label style={label}>H</label>
          <input type="number" min={MIN_SIZE} value={Math.round(ann.height)}
            onChange={(e) => onChange({ height: Math.max(MIN_SIZE, toNum(e.target.value, ann.height)) })} style={numInp} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-ghost" onClick={onDuplicate} style={{ flex: 1, fontSize: '0.7rem', padding: '8px 4px' }}>
          ⎘ Duplicate
        </button>
        <button className="btn btn-danger" onClick={onDelete} style={{ flex: 1, fontSize: '0.7rem', padding: '8px 4px' }}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}
