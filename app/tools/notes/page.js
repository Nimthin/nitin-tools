'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import TiptapLink from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';

/* ---- Custom FontSize extension (inline font-size via TextStyle) ---- */
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize?.replace(/["']/g, '') || null,
          renderHTML: attrs => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size) => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

/* ---- Custom FontFamily extension (inline font-family via TextStyle) ---- */
const FontFamily = Extension.create({
  name: 'fontFamily',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: el => el.style.fontFamily?.replace(/["']/g, '') || null,
          renderHTML: attrs => {
            if (!attrs.fontFamily) return {};
            return { style: `font-family: ${attrs.fontFamily}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontFamily: (family) => ({ chain }) => chain().setMark('textStyle', { fontFamily: family }).run(),
      unsetFontFamily: () => ({ chain }) => chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run(),
    };
  },
});

const FONT_SIZES = [
  { label: '8', value: '8px' },
  { label: '9', value: '9px' },
  { label: '10', value: '10px' },
  { label: '11', value: '11px' },
  { label: '12', value: '12px' },
  { label: '13', value: '13px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '30', value: '30px' },
  { label: '36', value: '36px' },
  { label: '48', value: '48px' },
  { label: '60', value: '60px' },
  { label: '72', value: '72px' },
];

const FONT_FAMILIES = [
  { label: 'System Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Consolas', value: 'Consolas, Monaco, monospace' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Garamond', value: 'Garamond, Baskerville, serif' },
  { label: 'Comic Sans', value: '"Comic Sans MS", cursive' },
  { label: 'Impact', value: 'Impact, Charcoal, sans-serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, serif' },
  { label: 'Century Gothic', value: '"Century Gothic", sans-serif' },
  { label: 'Copperplate', value: 'Copperplate, "Copperplate Gothic Light", sans-serif' },
];
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { marked } from 'marked';

const ImageNodeView = ({ node, updateAttributes, selected }) => {
  const { src, widthClass, alignClass, x, y, isAbsolute, width } = node.attrs;
  const wrapperRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    
    let startX = x || 0;
    let startY = y || 0;
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const parent = wrapperRef.current.offsetParent || document.body;
      const parentRect = parent.getBoundingClientRect();
      startX = rect.left - parentRect.left + parent.scrollLeft;
      startY = rect.top - parentRect.top + parent.scrollTop;
    }
    posStartRef.current = { x: startX, y: startY };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    const newX = posStartRef.current.x + dx;
    const newY = posStartRef.current.y + dy;

    if (wrapperRef.current) {
      wrapperRef.current.style.position = 'absolute';
      wrapperRef.current.style.left = `${newX}px`;
      wrapperRef.current.style.top = `${newY}px`;
      wrapperRef.current.style.zIndex = '1000';
    }
  };

  const handleMouseUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const finalX = posStartRef.current.x + dx;
    const finalY = posStartRef.current.y + dy;

    updateAttributes({
      x: finalX,
      y: finalY,
      isAbsolute: true
    });
  };

  const handleResizeMouseDown = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = wrapperRef.current ? wrapperRef.current.offsetWidth : 300;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth;

      if (direction === 'br' || direction === 'tr') {
        newWidth = startWidth + deltaX;
      } else if (direction === 'bl' || direction === 'tl') {
        newWidth = startWidth - deltaX;
      }

      if (newWidth < 50) newWidth = 50;

      if (wrapperRef.current) {
        wrapperRef.current.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = (upEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const finalWidth = wrapperRef.current ? wrapperRef.current.offsetWidth : startWidth;
      updateAttributes({
        width: `${finalWidth}px`
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const style = isAbsolute 
    ? {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: width || 'auto',
        zIndex: selected ? 1001 : 100,
        cursor: 'move',
        margin: 0
      }
    : {
        position: 'relative',
        width: width || 'auto',
        display: 'inline-block',
        cursor: 'grab',
      };

  return (
    <NodeViewWrapper 
      ref={wrapperRef}
      className={`custom-image-node ${widthClass} ${alignClass} ${selected ? 'ProseMirror-selectednode' : ''}`}
      style={style}
    >
      <img 
        src={src} 
        alt="" 
        onMouseDown={handleMouseDown}
        style={{
          display: 'block',
          width: '100%',
          userSelect: 'none',
          WebkitUserDrag: 'none'
        }}
      />

      {selected && (
        <>
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: '2px solid var(--pixel-cyan)',
              pointerEvents: 'none',
              zIndex: 10
            }}
          />
          {['tl', 'tr', 'bl', 'br'].map((dir) => {
            const handleStyle = {
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: '#ffffff',
              border: '2px solid var(--pixel-cyan)',
              borderRadius: '50%',
              zIndex: 20,
              cursor: dir === 'tl' || dir === 'br' ? 'nwse-resize' : 'nesw-resize'
            };
            
            if (dir.startsWith('t')) handleStyle.top = '-5px';
            if (dir.startsWith('b')) handleStyle.bottom = '-5px';
            if (dir.endsWith('l')) handleStyle.left = '-5px';
            if (dir.endsWith('r')) handleStyle.right = '-5px';
            
            return (
              <div 
                key={dir} 
                style={handleStyle} 
                onMouseDown={(e) => handleResizeMouseDown(e, dir)} 
              />
            );
          })}
        </>
      )}
    </NodeViewWrapper>
  );
};

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthClass: {
        default: 'img-width-xl',
        parseHTML: element => {
          const classes = element.getAttribute('class') || '';
          const match = classes.match(/img-width-\w+/);
          return match ? match[0] : 'img-width-xl';
        },
        renderHTML: attributes => {
          return {
            class: attributes.widthClass
          };
        }
      },
      width: {
        default: '100%',
        parseHTML: element => element.getAttribute('data-width') || element.style.width || '100%',
        renderHTML: attributes => {
          return {
            'data-width': attributes.width,
            style: `width: ${attributes.width}`
          };
        }
      },
      alignClass: {
        default: 'img-align-center',
        parseHTML: element => {
          const classes = element.getAttribute('class') || '';
          const match = classes.match(/img-align-\w+/);
          return match ? match[0] : 'img-align-center';
        },
        renderHTML: attributes => {
          return {
            class: attributes.alignClass
          };
        }
      },
      x: {
        default: 0,
        parseHTML: element => parseInt(element.getAttribute('data-x') || '0', 10),
        renderHTML: attributes => {
          return {
            'data-x': attributes.x
          };
        }
      },
      y: {
        default: 0,
        parseHTML: element => parseInt(element.getAttribute('data-y') || '0', 10),
        renderHTML: attributes => {
          return {
            'data-y': attributes.y
          };
        }
      },
      isAbsolute: {
        default: false,
        parseHTML: element => element.getAttribute('data-absolute') === 'true',
        renderHTML: attributes => {
          return {
            'data-absolute': attributes.isAbsolute ? 'true' : 'false'
          };
        }
      }
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  }
});

import Script from 'next/script';

import './notes.css';

/* ==========================================================================
   Constants
   ========================================================================== */

const STORAGE_KEY = 'dino-notes';
const FOLDERS_KEY = 'dino-notes-folders';
const MERGED_KEY = 'dino-notes-merged';
const LS_LIMIT = 5 * 1024 * 1024;

const DEFAULT_FOLDERS = [
  { id: '__all__', name: 'All Notes', icon: '📋', system: true },
  { id: '__starred__', name: 'Starred', icon: '⭐', system: true },
  { id: '__default__', name: 'General', icon: '📁', system: false },
];

/* ==========================================================================
   Helpers
   ========================================================================== */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPlainText(json) {
  if (!json || !json.content) return '';
  const extract = (node) => {
    if (node.type === 'text') return node.text || '';
    if (node.content) return node.content.map(extract).join('');
    return '';
  };
  return json.content.map(extract).join('\n');
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getStorageUsed() {
  try {
    const notesStr = localStorage.getItem(STORAGE_KEY) || '';
    const foldersStr = localStorage.getItem(FOLDERS_KEY) || '';
    const total = STORAGE_KEY.length + notesStr.length + FOLDERS_KEY.length + foldersStr.length;
    return total * 2;
  } catch { return 0; }
}

/* ==========================================================================
   JSON → Markdown converter
   ========================================================================== */

function jsonToMarkdown(json) {
  if (!json || !json.content) return '';
  return json.content.map(nodeToMd).join('\n');
}

function nodeToMd(node) {
  switch (node.type) {
    case 'heading':
      return '#'.repeat(node.attrs?.level || 1) + ' ' + inlineToMd(node.content) + '\n';
    case 'paragraph':
      return inlineToMd(node.content) + '\n';
    case 'bulletList':
      return (node.content || []).map(li => '- ' + nodeToMd(li).trim()).join('\n') + '\n';
    case 'orderedList':
      return (node.content || []).map((li, i) => `${i + 1}. ` + nodeToMd(li).trim()).join('\n') + '\n';
    case 'taskList':
      return (node.content || []).map(li => {
        const checked = li.attrs?.checked ? 'x' : ' ';
        return `- [${checked}] ` + nodeToMd(li).trim();
      }).join('\n') + '\n';
    case 'listItem':
    case 'taskItem':
      return (node.content || []).map(nodeToMd).join('').trim();
    case 'blockquote':
      return (node.content || []).map(n => '> ' + nodeToMd(n).trim()).join('\n') + '\n';
    case 'codeBlock':
      return '```\n' + inlineToMd(node.content) + '\n```\n';
    case 'horizontalRule':
      return '---\n';
    case 'table':
      return tableToMd(node) + '\n';
    case 'image':
      return `![image](${node.attrs?.src || ''})\n`;
    default:
      if (node.content) return node.content.map(nodeToMd).join('');
      return '';
  }
}

function inlineToMd(content) {
  if (!content) return '';
  return content.map(n => {
    if (n.type === 'text') {
      let t = n.text || '';
      const marks = n.marks || [];
      for (const m of marks) {
        if (m.type === 'bold') t = `**${t}**`;
        if (m.type === 'italic') t = `*${t}*`;
        if (m.type === 'strike') t = `~~${t}~~`;
        if (m.type === 'code') t = '`' + t + '`';
        if (m.type === 'underline') t = `<u>${t}</u>`;
      }
      return t;
    }
    if (n.type === 'hardBreak') return '\n';
    return '';
  }).join('');
}

function tableToMd(node) {
  if (!node.content) return '';
  const rows = node.content.filter(r => r.type === 'tableRow');
  if (!rows.length) return '';
  const mdRows = rows.map(row => {
    const cells = (row.content || []).map(cell => {
      return (cell.content || []).map(nodeToMd).join('').trim();
    });
    return '| ' + cells.join(' | ') + ' |';
  });
  if (mdRows.length > 0) {
    const firstRow = rows[0];
    const colCount = (firstRow.content || []).length;
    const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    mdRows.splice(1, 0, sep);
  }
  return mdRows.join('\n');
}

/* ==========================================================================
   JSON → HTML converter (for export)
   ========================================================================== */

function jsonToHtml(json, title) {
  if (!json) return '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || 'Note'}</title>
<style>
  body { font-family: 'Inter', -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #ffffff; color: #111111; line-height: 1.7; }
  h1 { font-size: 2rem; border-bottom: 2px solid #eaeaea; padding-bottom: 8px; color: #111111; }
  h2 { font-size: 1.5rem; color: #222222; }
  h3 { font-size: 1.2rem; color: #333333; }
  code { background: #f5f5f7; padding: 2px 6px; font-family: monospace; color: #d03030; border: 1px solid #e5e5ea; }
  pre { background: #f5f5f7; border: 1px solid #e5e5ea; padding: 16px; overflow-x: auto; color: #111111; }
  blockquote { border-left: 4px solid #007aff; padding-left: 16px; color: #555; font-style: italic; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e5ea; padding: 8px 12px; }
  th { background: #f5f5f7; color: #111111; }
  img { max-width: 100%; border: 1px solid #e5e5ea; }
  hr { border: none; border-top: 1px dashed #e5e5ea; margin: 20px 0; }
</style>
</head>
<body>
<h1>${title || 'Untitled Note'}</h1>
__CONTENT__
</body>
</html>`;
}

/* ==========================================================================
   Component: NotesApp
   ========================================================================== */

export default function NotesApp() {
  /* ---- State ---- */
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toast, setToast] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Collapsible sidebar states
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  // Sidebar resizing states
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240); // default to 240px
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320); // default to 320px
  const [isResizingRight, setIsResizingRight] = useState(false);

  const startResizeLeft = useCallback((e) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const resizeLeft = useCallback((e) => {
    if (e.buttons !== 1) {
      setIsResizingLeft(false);
      return;
    }
    const newWidth = e.clientX;
    if (newWidth >= 180 && newWidth <= 450) {
      setLeftSidebarWidth(newWidth);
    }
  }, []);

  const stopResizeLeft = useCallback(() => {
    setIsResizingLeft(false);
  }, []);

  const startResizeRight = useCallback((e) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  const resizeRight = useCallback((e) => {
    if (e.buttons !== 1) {
      setIsResizingRight(false);
      return;
    }
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 240 && newWidth <= 600) {
      setRightSidebarWidth(newWidth);
    }
  }, []);

  const stopResizeRight = useCallback(() => {
    setIsResizingRight(false);
  }, []);

  useEffect(() => {
    if (isResizingLeft) {
      window.addEventListener('mousemove', resizeLeft);
      window.addEventListener('mouseup', stopResizeLeft);
    } else {
      window.removeEventListener('mousemove', resizeLeft);
      window.removeEventListener('mouseup', stopResizeLeft);
    }
    return () => {
      window.removeEventListener('mousemove', resizeLeft);
      window.removeEventListener('mouseup', stopResizeLeft);
    };
  }, [isResizingLeft, resizeLeft, stopResizeLeft]);

  useEffect(() => {
    if (isResizingRight) {
      window.addEventListener('mousemove', resizeRight);
      window.addEventListener('mouseup', stopResizeRight);
    } else {
      window.removeEventListener('mousemove', resizeRight);
      window.removeEventListener('mouseup', stopResizeRight);
    }
    return () => {
      window.removeEventListener('mousemove', resizeRight);
      window.removeEventListener('mouseup', stopResizeRight);
    };
  }, [isResizingRight, resizeRight, stopResizeRight]);

  // Sync isDark state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('dino-theme');
      if (savedTheme) {
        setIsDark(savedTheme === 'dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(prefersDark);
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dino-theme', next);
    setIsDark(next === 'dark');
  }, []);

  /* ---- Active note ---- */
  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);

  /* ---- Toast ---- */
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  /* ---- AI Chat State & Callbacks ---- */
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiModel, setAiModel] = useState('llama-3.3-70b-versatile');
  const [aiLoading, setAiLoading] = useState(false);
  const editorRef = useRef(null);
  const aiMessagesEndRef = useRef(null);

  // Auto-scroll AI chat messages to bottom
  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiLoading]);

  const registerEditor = useCallback((editorInstance) => {
    editorRef.current = editorInstance;
  }, []);

  const insertTextAtCursor = useCallback(async (text) => {
    const editorObj = editorRef.current;
    if (editorObj) {
      try {
        const htmlContent = await marked.parse(text);
        editorObj.chain().focus().insertContent(htmlContent).run();
        showToast('✓ Inserted into note');
      } catch (err) {
        console.error('Markdown parse error:', err);
        editorObj.chain().focus().insertContent(text).run();
        showToast('✓ Inserted into note');
      }
    } else {
      showToast('⚠️ Editor not ready');
    }
  }, [showToast]);

  const clearAiChat = useCallback(() => {
    setAiMessages([]);
  }, []);

  const sendAiMessage = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;

    const userMessage = { role: 'user', content: text };
    const updated = [...aiMessages, userMessage];
    setAiMessages(updated);
    setAiInput('');
    setAiLoading(true);

    try {
      const editorJson = editorRef.current ? editorRef.current.getJSON() : (activeNote ? activeNote.content : null);
      const noteContext = activeNote ? {
        title: activeNote.title,
        content: getPlainText(editorJson),
      } : null;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          selectedModel: aiModel,
          isNotesApp: true,
          noteContext,
        }),
      });

      if (!res.ok) throw new Error('API Error');

      const data = await res.json();
      setAiMessages([...updated, { role: 'assistant', content: data.message }]);
    } catch {
      setAiMessages([...updated, { role: 'assistant', content: '⚠️ Error: Failed to generate response.' }]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiMessages, aiModel, aiLoading, activeNote]);

  const fileInputRef = useRef(null);
  const saveTimerRef = useRef(null);

  /* ---- Load data ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setNotes(JSON.parse(raw));
    } catch {}
    setMounted(true);
  }, []);

  /* ---- Save helpers ---- */
  const saveNotesLocal = useCallback((updated) => {
    setNotes(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      showToast('⚠️ Storage full! Delete some notes.');
    }
  }, [showToast]);

  const handleImportClick = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.version && data.note) {
          const imported = {
            ...data.note, id: generateId(),
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          saveNotesLocal([imported, ...notes]);
          setActiveNoteId(imported.id);
          showToast('✓ Note imported!');
        } else {
          showToast('⚠️ Invalid .dino file');
        }
      } catch { showToast('⚠️ Failed to parse file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [notes, saveNotesLocal, showToast]);

  /* ---- Filtered notes ---- */
  const filteredNotes = useMemo(() => {
    let list = [...notes];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        getPlainText(n.content).toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [notes, searchQuery]);

  /* ====================================================================== */
  /*  CRUD: Notes                                                            */
  /* ====================================================================== */

  const createNote = useCallback(async () => {
    const note = {
      id: generateId(), title: '', content: null, folderId: '__default__',
      starred: false, createdAt: Date.now(), updatedAt: Date.now(),
    };
    saveNotesLocal([note, ...notes]);
    setActiveNoteId(note.id);
    setSidebarOpen(false);
  }, [notes, saveNotesLocal]);

  const deleteNote = useCallback((id) => {
    setConfirmDialog({
      title: 'Delete Note?',
      message: 'This action cannot be undone.',
      onConfirm: async () => {
        const updated = notes.filter(n => n.id !== id);
        saveNotesLocal(updated);
        if (activeNoteId === id) setActiveNoteId(null);
        setConfirmDialog(null);
        showToast('✓ Note deleted');
      },
    });
  }, [notes, activeNoteId, saveNotesLocal, showToast]);

  const toggleStar = useCallback(async (id) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const newStarred = !note.starred;

    const updated = notes.map(n =>
      n.id === id ? { ...n, starred: newStarred, updatedAt: Date.now() } : n
    );
    saveNotesLocal(updated);
  }, [notes, saveNotesLocal]);

  const updateNoteTitle = useCallback((id, title) => {
    const updated = notes.map(n =>
      n.id === id ? { ...n, title, updatedAt: Date.now() } : n
    );
    saveNotesLocal(updated);
  }, [notes, saveNotesLocal]);

  const updateNoteContent = useCallback((id, content) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setNotes(prev => {
        const updated = prev.map(n =>
          n.id === id ? { ...n, content, updatedAt: Date.now() } : n
        );
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }, 500);
  }, []);

  /* ====================================================================== */
  /*  Export                                                                  */
  /* ====================================================================== */

  const download = useCallback(async (blob, filename) => {
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const ext = filename.split('.').pop().toLowerCase();
        let mimeType = 'text/plain';
        let description = 'Text File';
        
        if (ext === 'md') {
          mimeType = 'text/markdown';
          description = 'Markdown File';
        } else if (ext === 'html') {
          mimeType = 'text/html';
          description = 'HTML File';
        } else if (ext === 'dino') {
          mimeType = 'application/json';
          description = 'Dino Note File';
        } else if (ext === 'pdf') {
          mimeType = 'application/pdf';
          description = 'PDF Document';
        } else if (ext === 'jpg' || ext === 'jpeg') {
          mimeType = 'image/jpeg';
          description = 'JPEG Image';
        } else if (ext === 'zip') {
          mimeType = 'application/zip';
          description = 'ZIP Archive';
        }
        
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: description,
            accept: {
              [mimeType]: [`.${ext}`]
            }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (err) {
        if (err.name === 'AbortError') {
          showToast('Export cancelled');
          return false;
        }
        console.warn('showSaveFilePicker error, falling back:', err);
      }
    }

    // Fallback to classic link click download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  }, [showToast]);

  const exportAs = useCallback(async (format) => {
    if (!activeNote) return;
    const title = activeNote.title || 'Untitled Note';
    const plainText = getPlainText(activeNote.content);

    switch (format) {
      case 'txt': {
        const blob = new Blob([plainText], { type: 'text/plain' });
        const success = await download(blob, `${title}.txt`);
        if (success) showToast('✓ Exported as TXT');
        break;
      }
      case 'html': {
        const editorEl = document.querySelector('.notes-editor-content .ProseMirror');
        let htmlTemplate = jsonToHtml(activeNote.content, title);
        htmlTemplate = htmlTemplate.replace('__CONTENT__', editorEl ? editorEl.innerHTML : '');
        const blob = new Blob([htmlTemplate], { type: 'text/html' });
        const success = await download(blob, `${title}.html`);
        if (success) showToast('✓ Exported as HTML');
        break;
      }
      case 'dino': {
        const data = { version: 1, exportedAt: Date.now(), note: activeNote };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const success = await download(blob, `${title}.dino`);
        if (success) showToast('✓ Exported as .dino');
        break;
      }
      case 'pdf': {
        const editorEl = document.querySelector('.notes-editor-content .ProseMirror');
        if (!editorEl) return;
        try {
          editorEl.classList.add('notes-export-rendering');
          // Wait slightly for DOM styling reflow
          await new Promise(resolve => setTimeout(resolve, 50));
          
          const html2canvas = (await import('html2canvas')).default;
          const { jsPDF } = await import('jspdf');
          const canvas = await html2canvas(editorEl, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
          const imgData = canvas.toDataURL('image/jpeg', 0.75);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          const pageHeight = pdf.internal.pageSize.getHeight();
          let position = 0;
          if (pdfHeight <= pageHeight) {
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          } else {
            let remaining = pdfHeight;
            while (remaining > 0) {
              pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
              remaining -= pageHeight;
              position -= pageHeight;
              if (remaining > 0) pdf.addPage();
            }
          }
          const pdfBlob = pdf.output('blob');
          const success = await download(pdfBlob, `${title}.pdf`);
          if (success) showToast('✓ Exported as PDF');
        } catch (err) {
          console.error(err);
          showToast('⚠️ PDF export failed');
        } finally {
          editorEl.classList.remove('notes-export-rendering');
        }
        break;
      }
      case 'jpg': {
        const editorEl = document.querySelector('.notes-editor-content .ProseMirror');
        if (!editorEl) return;
        try {
          editorEl.classList.add('notes-export-rendering');
          // Wait slightly for DOM styling reflow
          await new Promise(resolve => setTimeout(resolve, 50));
          
          const html2canvas = (await import('html2canvas')).default;
          const fflate = await import('fflate');
          
          const canvas = await html2canvas(editorEl, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
          
          // Calculate A4 aspect ratio height in pixels
          // A4 aspect ratio: height / width = 297 / 210 = 1.4142
          const pageHeightInPx = Math.floor(canvas.width * 1.4142);
          const totalHeight = canvas.height;
          const numPages = Math.ceil(totalHeight / pageHeightInPx);
          
          const zipData = {};
          
          for (let i = 0; i < numPages; i++) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = pageHeightInPx;
            
            const ctx = tempCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            const sourceY = i * pageHeightInPx;
            const sourceHeight = Math.min(pageHeightInPx, totalHeight - sourceY);
            
            ctx.drawImage(
              canvas,
              0, sourceY, canvas.width, sourceHeight,
              0, 0, tempCanvas.width, sourceHeight
            );
            
            const imgDataUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
            
            // Convert Base64 dataURL to Uint8Array for fflate
            const base64 = imgDataUrl.split(',')[1];
            const binary = atob(base64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let j = 0; j < len; j++) {
              bytes[j] = binary.charCodeAt(j);
            }
            
            zipData[`page_${i + 1}.jpg`] = bytes;
          }
          
          const zipped = fflate.zipSync(zipData);
          const zipBlob = new Blob([zipped], { type: 'application/zip' });
          
          const success = await download(zipBlob, `${title}_images.zip`);
          if (success) showToast('✓ Exported ZIP of JPG pages');
        } catch (err) {
          console.error(err);
          showToast('⚠️ JPG export failed');
        } finally {
          editorEl.classList.remove('notes-export-rendering');
        }
        break;
      }
      default: break;
    }
  }, [activeNote, showToast, download]);

  /* ---- Import ---- */
  const handleImportNote = useCallback((imported) => {
    saveNotesLocal([imported, ...notes]);
    setActiveNoteId(imported.id);
    showToast('✓ Note imported!');
  }, [notes, saveNotesLocal, showToast]);

  /* ---- Drop handler ---- */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.dino')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.version && data.note) {
          const imported = {
            ...data.note, id: generateId(),
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          saveNotesLocal([imported, ...notes]);
          setActiveNoteId(imported.id);
          showToast('✓ Note imported via drag & drop!');
        }
      } catch {}
    };
    reader.readAsText(file);
  }, [notes, saveNotesLocal, showToast]);

  if (!mounted) return null;

  /* ====================================================================== */
  /*  Render                                                                 */
  /* ====================================================================== */
  return (
    <div className="notes-app" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      {/* ---- Sidebar ---- */}
      <aside 
        className={`notes-sidebar ${sidebarOpen ? 'mobile-open' : ''} ${leftSidebarCollapsed ? 'collapsed' : ''} ${isResizingLeft ? 'resizing' : ''}`}
        style={leftSidebarCollapsed ? {} : { width: leftSidebarWidth, minWidth: leftSidebarWidth }}
      >
        <div className="notes-sidebar-header">
          <div className="notes-sidebar-title">
            <span>📝 DINONOTES</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={toggleTheme} className="notes-theme-toggle" title="Toggle Theme">
                {isDark ? '☀️' : '🌙'}
              </button>
              <Link href="/">← HOME</Link>
            </div>
          </div>

          <div className="notes-sidebar-actions">
            <button onClick={createNote}>+ NEW NOTE</button>
            <button onClick={() => fileInputRef.current?.click()}>📤 IMPORT</button>
          </div>
        </div>

        <div className="notes-search">
          <span className="notes-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Note list */}
        <div className="notes-list">
          {filteredNotes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty-icon">📄</div>
              <div className="notes-empty-text">
                {searchQuery ? 'No notes match your search' : 'No notes yet. Create one!'}
              </div>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`note-card ${activeNoteId === note.id ? 'active' : ''}`}
                onClick={() => { setActiveNoteId(note.id); setSidebarOpen(false); }}
              >
                <div className="note-card-title">
                  {note.starred && <span className="star-icon">★</span>}
                  {note.title || 'Untitled Note'}
                </div>
                <div className="note-card-preview">
                  {getPlainText(note.content).slice(0, 80) || 'Empty note'}
                </div>
                <div className="note-card-meta">{formatDate(note.updatedAt)}</div>
                <div className="note-card-actions">
                  <button onClick={(e) => { e.stopPropagation(); toggleStar(note.id); }}>
                    {note.starred ? '★' : '☆'}
                  </button>
                  <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}>
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {!leftSidebarCollapsed && (
          <div className="sidebar-resizer left-resizer" onMouseDown={startResizeLeft} />
        )}
      </aside>

      {/* ---- Editor ---- */}
      <main className="notes-editor-area">
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            onTitleChange={(title) => updateNoteTitle(activeNote.id, title)}
            onContentChange={(content) => updateNoteContent(activeNote.id, content)}
            onToggleStar={() => toggleStar(activeNote.id)}
            onRegisterEditor={registerEditor}
            leftSidebarCollapsed={leftSidebarCollapsed}
            onToggleLeftSidebar={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
            rightSidebarCollapsed={rightSidebarCollapsed}
            onToggleRightSidebar={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
            exportAs={exportAs}
            showToast={showToast}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="notes-editor-header" style={{ borderBottom: 'none', background: 'transparent' }}>
              <button 
                className="sidebar-toggle-btn left-toggle" 
                onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)} 
                title={leftSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
              </button>
            </div>
            <div className="notes-empty" style={{ flex: 1, marginTop: -40 }}>
              <div className="notes-empty-icon">📝</div>
              <div className="notes-empty-text">
                Select a note to edit<br />or create a new one
              </div>
              <button
                onClick={createNote}
                style={{
                  marginTop: 12, padding: '10px 20px',
                  fontFamily: 'var(--notes-font)', fontSize: '0.85rem',
                  fontWeight: 600,
                  background: 'var(--pixel-cyan)', color: '#fff',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                }}
              >
                + CREATE NOTE
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ---- Properties Sidebar (Dedicated AI Assistant) ---- */}
      <aside 
        className={`notes-properties ${rightSidebarCollapsed ? 'collapsed' : ''} ${isResizingRight ? 'resizing' : ''}`}
        style={rightSidebarCollapsed ? {} : { width: rightSidebarWidth, minWidth: rightSidebarWidth }}
      >
        {!rightSidebarCollapsed && (
          <div className="sidebar-resizer right-resizer" onMouseDown={startResizeRight} />
        )}
        {activeNote ? (
          <div className="notes-ai-section">
            <div className="notes-properties-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 16px' }}>
              <div className="notes-properties-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🤖 DINO AI</span>
                <button onClick={clearAiChat} style={{ color: 'var(--pixel-red)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600 }}>
                  CLEAR
                </button>
              </div>
              
              <div className="notes-ai-messages" style={{ flex: 1, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
                {aiMessages.length === 0 ? (
                  <div className="notes-empty" style={{ padding: '40px 10px', height: 'auto' }}>
                    <div className="notes-empty-text" style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
                      Ask Dino AI to write, edit, summarize, or translate text for your notes!
                    </div>
                  </div>
                ) : (
                  aiMessages.map((msg, i) => (
                    <div key={i} className={`notes-ai-msg ${msg.role}`} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column' }}>
                      <div className="notes-ai-msg-sender" style={{ fontSize: '0.6rem', fontWeight: 600, color: msg.role === 'user' ? 'var(--pixel-cyan)' : 'var(--pixel-yellow)', marginBottom: 2 }}>
                        {msg.role === 'user' ? 'YOU' : 'DINO AI'}
                      </div>
                      <div className={`notes-ai-msg-text ${msg.role === 'assistant' ? 'notes-markdown-body' : ''}`} style={{
                        background: msg.role === 'user' ? 'rgba(0,122,255,0.06)' : 'var(--pixel-bg-card-hover)',
                        border: '1px solid var(--pixel-border)',
                        borderRadius: 8,
                        padding: 8,
                        fontSize: '0.78rem',
                        color: 'var(--pixel-text)',
                        wordBreak: 'break-word',
                        lineHeight: '1.5'
                      }}>
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{
                                      margin: '6px 0',
                                      borderRadius: '4px',
                                      fontSize: '0.72rem',
                                      border: '1px solid var(--pixel-border)',
                                      background: 'var(--pixel-bg-card)',
                                    }}
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className="notes-inline-code" {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              img({ node, src, alt, ...props }) {
                                return <img src={src} alt={alt} style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', marginTop: '6px' }} {...props} />;
                              },
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                      {msg.role === 'assistant' && !msg.content.startsWith('⚠️') && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <button
                            onClick={() => insertTextAtCursor(msg.content)}
                            style={{
                              padding: '4px 8px',
                              fontFamily: 'var(--notes-font)',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              background: 'var(--pixel-green)',
                              color: '#fff',
                              border: '1px solid var(--pixel-border)',
                              borderRadius: 4,
                              cursor: 'pointer',
                              textTransform: 'uppercase'
                            }}
                          >
                            + Insert
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              showToast('✓ Copied to clipboard');
                            }}
                            style={{
                              padding: '4px 8px',
                              fontFamily: 'var(--notes-font)',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              background: 'var(--pixel-bg)',
                              color: 'var(--pixel-text-dim)',
                              border: '1px solid var(--pixel-border)',
                              borderRadius: 4,
                              cursor: 'pointer',
                              textTransform: 'uppercase'
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {aiLoading && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '10px 0' }}>
                    <span className="loading-text" style={{ fontSize: '0.65rem', fontWeight: 600 }}>⏳ THINKING...</span>
                  </div>
                )}
                <div ref={aiMessagesEndRef} />
              </div>

              <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--pixel-border)', paddingTop: 10 }}>
                <input
                  type="text"
                  placeholder="Ask AI..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendAiMessage(); }}
                  disabled={aiLoading}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    background: 'var(--pixel-bg)',
                    color: 'var(--pixel-text)',
                    border: '1px solid var(--pixel-border)',
                    borderRadius: 6,
                    outline: 'none',
                    fontSize: '0.8rem'
                  }}
                />
                <button
                  onClick={sendAiMessage}
                  disabled={!aiInput.trim() || aiLoading}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--pixel-cyan)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'var(--notes-font)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  SEND
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="notes-empty" style={{ padding: 20 }}>
            <div className="notes-empty-text">Select a note to talk to AI</div>
          </div>
        )}
      </aside>

      {/* ---- Mobile toggles ---- */}
      <button className="notes-mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* ---- Confirm dialog ---- */}
      {confirmDialog && (
        <div className="notes-confirm-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="notes-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setConfirmDialog(null)}>CANCEL</button>
              <button className="confirm-delete" onClick={confirmDialog.onConfirm}>DELETE</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Toast ---- */}
      <div className={`notes-toast ${toast ? 'show' : ''}`}>{toast}</div>
      <input ref={fileInputRef} type="file" accept=".dino" onChange={handleImportClick} style={{ display: 'none' }} />
    </div>
  );
}

const SYMBOL_CATEGORIES = {
  Math: [
    'π', '√', '∞', '∑', '∏', '∫', '∂', '∆', '∇', '±', '×', '÷', '≈', '≠', '≤', '≥', '≡', '∝', '∈', '∉', '⊂', '⊃', '∪', '∩', '∧', '∨', '¬', '⇒', '⇔', '∀', '∃', '½', '⅓', '⅔', '¼', '¾', '⅛', '⅜', '⅝', '⅞'
  ],
  Chemistry: [
    '→', '⇄', '⇌', '↑', '↓', '⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁺', '⁻', '⁼', '⁽', '⁾', 'ⁿ', '₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₊', '₋', '₌', '₍', '₎', '(aq)', '(g)', '(l)', '(s)', '℃', '℉'
  ],
  Greek: [
    'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'
  ],
  General: [
    '←', '→', '↑', '↓', '↔', '↕', '↖', '↗', '↘', '↙', '$', '€', '£', '¥', '₹', '¢', '¤', '™', '®', '©', '§', '¶', '•', '†', '‡', '°', '★', '☆', '✓', '✗', '✦', '✧', '✿', '❀'
  ]
};

/* ==========================================================================
   Component: NoteEditor (TipTap)
   ========================================================================== */

function NoteEditor({ 
  note, onTitleChange, onContentChange, onToggleStar, onRegisterEditor,
  leftSidebarCollapsed, onToggleLeftSidebar, rightSidebarCollapsed, onToggleRightSidebar,
  exportAs, showToast 
}) {
  const [textColor, setTextColor] = useState('#ffffff');
  const [highlightColor, setHighlightColor] = useState('#ffeb3b');
  const [exportOpen, setExportOpen] = useState(false);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [activeSymbolCategory, setActiveSymbolCategory] = useState('Math');

  const [drawOpen, setDrawOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontSize,
      FontFamily,
      Placeholder.configure({ placeholder: 'Start writing your note...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CustomImage.configure({ inline: false }),
      TiptapLink.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Youtube.configure({
        width: 640,
        height: 480,
        nocookie: true,
      }),
    ],
    content: note.content || '',
    onUpdate: ({ editor }) => {
      onContentChange(editor.getJSON());
    },
    editorProps: {
      attributes: { spellcheck: 'true' },
    },
  });

  const [recognition, setRecognition] = useState(null);
  const [isDictating, setIsDictating] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';
        setRecognition(rec);
      }
    }
  }, []);

  const toggleDictation = useCallback(() => {
    if (!recognition) {
      showToast('⚠️ Voice-to-Text is not supported in this browser.');
      return;
    }
    if (isDictating) {
      recognition.stop();
      setIsDictating(false);
    } else {
      try {
        recognition.start();
        setIsDictating(true);
        showToast('🎙️ Dictation active. Speak clearly...');
      } catch (err) {
        console.error(err);
        showToast('⚠️ Failed to start speech recognition.');
      }
    }
  }, [recognition, isDictating, showToast]);

  useEffect(() => {
    if (!recognition) return;
    
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      if (editor) {
        editor.chain().focus().insertContent(transcript + ' ').run();
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        showToast('⚠️ Microphone permission denied.');
      } else {
        showToast(`🎙️ Speech error: ${event.error}`);
      }
      setIsDictating(false);
    };
    
    recognition.onend = () => {
      setIsDictating(false);
    };

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, [recognition, editor, showToast]);

  // Register editor instance with parent
  useEffect(() => {
    if (editor) {
      onRegisterEditor(editor);
    }
    return () => {
      onRegisterEditor(null);
    };
  }, [editor, onRegisterEditor]);

  const insertImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        editor.chain().focus().setImage({ src: ev.target.result }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor]);

  if (!editor) return null;

  const isImageActive = editor.isActive('image');
  const currentAttrs = isImageActive ? editor.getAttributes('image') : {};
  const currentAlignClass = currentAttrs.alignClass || 'img-align-center';
  const isAbsolute = currentAttrs.isAbsolute || false;

  return (
    <>
      <div className="notes-editor-header">
        <button 
          className={`sidebar-toggle-btn left-toggle ${!leftSidebarCollapsed ? 'is-active' : ''}`}
          onClick={onToggleLeftSidebar} 
          title={leftSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
          style={{ marginRight: 8 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>

        <input
          className="notes-editor-title-input"
          value={note.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled Note"
        />

        <div className="notes-editor-header-actions">
          <button className={note.starred ? 'starred' : ''} onClick={onToggleStar} title={note.starred ? 'Unstar' : 'Star'}>
            {note.starred ? '★' : '☆'}
          </button>

          {/* Export Dropdown */}
          <div className="export-dropdown-container">
            <button className="export-toggle-btn" onClick={() => setExportOpen(!exportOpen)}>
              📥 Export / Share
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => { exportAs('pdf'); setExportOpen(false); }}>📄 Export PDF</button>
                <button onClick={() => { exportAs('jpg'); setExportOpen(false); }}>🖼️ Export JPG</button>
                <button onClick={() => { exportAs('txt'); setExportOpen(false); }}>📃 Export Plain Text</button>
                <button onClick={() => { exportAs('html'); setExportOpen(false); }}>🌐 Export HTML</button>
                <button onClick={() => { exportAs('dino'); setExportOpen(false); }}>🦕 Export DINO Note</button>
              </div>
            )}
          </div>

          <button 
            className={`sidebar-toggle-btn right-toggle ${!rightSidebarCollapsed ? 'is-active' : ''}`}
            onClick={onToggleRightSidebar} 
            title={rightSidebarCollapsed ? "Show AI Chat" : "Hide AI Chat"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </button>
        </div>
      </div>

      <div className="notes-toolbar">
        {/* Font Family */}
        <div className="notes-toolbar-group">
          <select
            title="Font"
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().setFontFamily(e.target.value).run();
              } else {
                editor.chain().focus().unsetFontFamily().run();
              }
            }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || 'inherit' }}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="notes-toolbar-divider" />
        {/* Font Size */}
        <div className="notes-toolbar-group">
          <select
            title="Size"
            value={editor.getAttributes('textStyle').fontSize || '16px'}
            onChange={(e) => {
              if (e.target.value === '16px') {
                editor.chain().focus().unsetFontSize().run();
              } else {
                editor.chain().focus().setFontSize(e.target.value).run();
              }
            }}
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="notes-toolbar-divider" />
        {/* Text formatting */}
        <div className="notes-toolbar-group">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="Bold"><b>B</b></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="Italic"><i>I</i></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title="Underline"><u>U</u></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="Strikethrough"><s>S</s></button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'is-active' : ''} title="Code">&lt;/&gt;</button>
        </div>
        <div className="notes-toolbar-divider" />
        {/* Lists */}
        <div className="notes-toolbar-group">
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="Bullet list">•</button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="Numbered list">1.</button>
          <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={editor.isActive('taskList') ? 'is-active' : ''} title="Checklist">☑</button>
        </div>
        <div className="notes-toolbar-divider" />
        {/* Alignment */}
        <div className="notes-toolbar-group">
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''} title="Align Left">⭷</button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''} title="Align Center">☰</button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''} title="Align Right">⭸</button>
        </div>
        <div className="notes-toolbar-divider" />
        {/* Blocks */}
        <div className="notes-toolbar-group">
          <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''} title="Quote">❝</button>
          <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'is-active' : ''} title="Code block">{'{}'}</button>
          <button onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">—</button>
        </div>
        <div className="notes-toolbar-divider" />
        {/* Table */}
        <div className="notes-toolbar-group">
          <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Table">⊞</button>
          {editor.isActive('table') && (
            <>
              <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add col">+C</button>
              <button onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row">+R</button>
              <button onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table" style={{ color: 'var(--pixel-red)' }}>✕T</button>
            </>
          )}
        </div>
        <div className="notes-toolbar-divider" />
        {/* Colors */}
        <div className="notes-toolbar-group">
          <div className="color-input-wrap" title="Text color">
            <input type="color" value={textColor} onChange={(e) => { setTextColor(e.target.value); editor.chain().focus().setColor(e.target.value).run(); }} />
          </div>
          <div className="color-input-wrap" title="Highlight">
            <input type="color" value={highlightColor} onChange={(e) => { setHighlightColor(e.target.value); editor.chain().focus().toggleHighlight({ color: e.target.value }).run(); }} />
          </div>
        </div>
        <div className="notes-toolbar-divider" />
        {/* Special Characters */}
        <div className="notes-toolbar-group">
          <button 
            onClick={() => setSymbolsOpen(!symbolsOpen)} 
            className={symbolsOpen ? 'is-active' : ''} 
            title="Insert Special Character (Math, Chemistry, Greek, etc.)"
            style={{ fontWeight: 'bold' }}
          >
            Ω
          </button>
        </div>
        <div className="notes-toolbar-divider" />
        {/* Image, Undo, Redo */}
        <div className="notes-toolbar-group">
          <button onClick={insertImage} title="Insert Image" className={`notes-img-btn ${isImageActive ? 'is-active' : ''}`}>🖼️</button>
          <button onClick={() => setDrawOpen(true)} title="Draw Sketch" className="notes-draw-btn">🎨</button>
          <button onClick={toggleDictation} className={`notes-dictate-btn ${isDictating ? 'is-active' : ''}`} title={isDictating ? "Stop Dictation" : "Voice-to-Text (Dictate)"}>🎙️</button>
          <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↩</button>
          <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↪</button>
        </div>
      </div>

      {symbolsOpen && (
        <div style={{ position: 'relative', width: '100%', zIndex: 100 }}>
          <div className="symbols-popover-overlay" onClick={() => setSymbolsOpen(false)} />
          <div className="symbols-popover" style={{ position: 'absolute', top: 0, right: '120px', left: 'auto', transform: 'none' }}>
            <div className="symbols-tabs">
              {Object.keys(SYMBOL_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  className={activeSymbolCategory === cat ? 'active' : ''}
                  onClick={() => setActiveSymbolCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="symbols-grid">
              {SYMBOL_CATEGORIES[activeSymbolCategory].map((sym) => (
                <button
                  key={sym}
                  onClick={() => editor.chain().focus().insertContent(sym).run()}
                  title={`Insert ${sym}`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isImageActive && (
        <div className="notes-image-toolbar">
          <span className="toolbar-label">Align:</span>
          <button 
            onClick={() => editor.chain().focus().updateAttributes('image', { alignClass: 'img-align-left' }).run()}
            className={currentAlignClass === 'img-align-left' ? 'is-active' : ''}
          >Left</button>
          <button 
            onClick={() => editor.chain().focus().updateAttributes('image', { alignClass: 'img-align-center' }).run()}
            className={currentAlignClass === 'img-align-center' ? 'is-active' : ''}
          >Center</button>
          <button 
            onClick={() => editor.chain().focus().updateAttributes('image', { alignClass: 'img-align-right' }).run()}
            className={currentAlignClass === 'img-align-right' ? 'is-active' : ''}
          >Right</button>
          {isAbsolute && (
            <>
              <div className="notes-toolbar-divider" />
              <button 
                onClick={() => editor.chain().focus().updateAttributes('image', { isAbsolute: false, x: 0, y: 0 }).run()}
                title="Pin image back to document text flow"
              >
                📌 Inline
              </button>
            </>
          )}
          <div className="notes-toolbar-divider" />
          <button 
            onClick={() => editor.chain().focus().deleteSelection().run()}
            className="delete-btn"
            style={{ color: 'var(--pixel-red)', borderColor: 'var(--pixel-red)', background: 'rgba(255,59,48,0.06)' }}
            title="Delete Image"
          >
            🗑️ Delete Image
          </button>
        </div>
      )}

      <div className="notes-editor-content">
        <EditorContent editor={editor} />
      </div>



      {drawOpen && (
        <DrawingModal 
          onClose={() => setDrawOpen(false)}
          onSave={(pngData) => {
            editor.chain().focus().setImage({ src: pngData }).run();
            setDrawOpen(false);
          }}
        />
      )}
    </>
  );
}



/* ==========================================================================
   Helper Functions for Drawing Canvas
   ========================================================================== */

function spray(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  const radius = size * 2;
  const density = Math.min(Math.max(size * 4, 15), 50);
  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const sx = x + r * Math.cos(angle);
    const sy = y + r * Math.sin(angle);
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.restore();
}

function drawCalligraphy(ctx, prevX, prevY, currX, currY, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  
  const dist = Math.hypot(currX - prevX, currY - prevY);
  const steps = Math.max(Math.floor(dist / 1.5), 1);
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = prevX + (currX - prevX) * t;
    const y = prevY + (currY - prevY) * t;
    
    ctx.beginPath();
    ctx.ellipse(x, y, size, size / 3, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPaperTemplate(ctx, width, height, style, bgColor) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (style === 'blank') return;

  ctx.save();
  
  const isDark = bgColor === '#1e1e1e';
  const lineColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
  const marginColor = isDark ? 'rgba(255, 69, 58, 0.3)' : 'rgba(255, 59, 48, 0.35)';

  ctx.lineWidth = 1;

  if (style === 'grid') {
    ctx.strokeStyle = lineColor;
    for (let x = 20; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 20; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else if (style === 'ruled') {
    const lineSpacing = 24;
    const ruledColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 122, 255, 0.15)';
    ctx.strokeStyle = ruledColor;
    
    for (let y = 40; y < height; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = marginColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(60, height);
    ctx.stroke();
  } else if (style === 'dotted') {
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
    const spacing = 20;
    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/* ==========================================================================
   Component: DrawingModal (Canvas Sketchpad)
   ========================================================================== */

function DrawingModal({ onClose, onSave }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const strokesCanvasRef = useRef(null);
  const strokesCtxRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);

  const [tool, setTool] = useState('pencil'); // 'pencil', 'highlighter', 'spray', 'calligraphy'
  const [shapeMode, setShapeMode] = useState('freehand'); // 'freehand', 'line', 'arrow', 'rectangle', 'circle'
  const [isFilled, setIsFilled] = useState(false);
  const [paperStyle, setPaperStyle] = useState('blank'); // 'blank', 'grid', 'ruled', 'dotted'
  const [paperColor, setPaperColor] = useState('#ffffff'); // '#ffffff', '#fdf6e3', '#f0f8ff', '#1e1e1e'

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const startPosRef = useRef(null);
  const lastPosRef = useRef(null);

  const redrawVisibleCanvas = useCallback((previewFn) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    drawPaperTemplate(ctx, canvas.width, canvas.height, paperStyle, paperColor);
    if (strokesCanvasRef.current) {
      ctx.drawImage(strokesCanvasRef.current, 0, 0);
    }
    if (previewFn) {
      previewFn(ctx);
    }
  }, [paperStyle, paperColor]);

  // Redraw canvas if paper style or color changes
  useEffect(() => {
    redrawVisibleCanvas();
  }, [paperStyle, paperColor, redrawVisibleCanvas]);

  // Initialize canvas
  useEffect(() => {
    // Initialize strokes canvas
    if (!strokesCanvasRef.current) {
      strokesCanvasRef.current = document.createElement('canvas');
    }
    strokesCanvasRef.current.width = 640;
    strokesCanvasRef.current.height = 400;

    const sCtx = strokesCanvasRef.current.getContext('2d');
    sCtx.lineCap = 'round';
    sCtx.lineJoin = 'round';
    strokesCtxRef.current = sCtx;

    // Initialize visible canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 640;
    canvas.height = 400;

    const ctx = canvas.getContext('2d');
    contextRef.current = ctx;

    redrawVisibleCanvas();

    // Initial undo stack state (empty transparent offline strokes)
    const initialData = sCtx.getImageData(0, 0, 640, 400);
    setUndoStack([initialData]);
    setRedoStack([]);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    setIsDrawing(true);

    startPosRef.current = { x, y };
    lastPosRef.current = { x, y };

    const sCtx = strokesCtxRef.current;
    if (!sCtx) return;

    if (shapeMode === 'freehand') {
      sCtx.save();
      if (isEraser) {
        sCtx.globalCompositeOperation = 'destination-out';
        sCtx.lineWidth = brushSize * 2.5;
        sCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
        sCtx.lineCap = 'round';
        sCtx.lineJoin = 'round';
      } else {
        sCtx.globalCompositeOperation = 'source-over';
        if (tool === 'pencil') {
          sCtx.strokeStyle = color;
          sCtx.globalAlpha = 1.0;
          sCtx.lineWidth = brushSize;
          sCtx.lineCap = 'round';
          sCtx.lineJoin = 'round';
        } else if (tool === 'highlighter') {
          sCtx.strokeStyle = color;
          sCtx.globalAlpha = 0.45;
          sCtx.lineWidth = brushSize * 2.5;
          sCtx.lineCap = 'square';
          sCtx.lineJoin = 'miter';
        } else if (tool === 'spray') {
          sCtx.fillStyle = color;
          sCtx.globalAlpha = 0.65;
        } else if (tool === 'calligraphy') {
          sCtx.fillStyle = color;
          sCtx.globalAlpha = 1.0;
        }
      }

      if (tool === 'spray' && !isEraser) {
        spray(sCtx, x, y, brushSize, color);
      } else if (tool === 'calligraphy' && !isEraser) {
        drawCalligraphy(sCtx, x, y, x, y, brushSize, color);
      } else {
        sCtx.beginPath();
        sCtx.moveTo(x, y);
        sCtx.lineTo(x, y);
        sCtx.stroke();
      }
      sCtx.restore();
      redrawVisibleCanvas();
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const sCtx = strokesCtxRef.current;
    if (!sCtx) return;

    if (shapeMode === 'freehand') {
      sCtx.save();
      if (isEraser) {
        sCtx.globalCompositeOperation = 'destination-out';
        sCtx.lineWidth = brushSize * 2.5;
        sCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
        sCtx.lineCap = 'round';
        sCtx.lineJoin = 'round';
        sCtx.beginPath();
        if (lastPosRef.current) {
          sCtx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        }
        sCtx.lineTo(x, y);
        sCtx.stroke();
      } else {
        sCtx.globalCompositeOperation = 'source-over';
        if (tool === 'pencil') {
          sCtx.strokeStyle = color;
          sCtx.globalAlpha = 1.0;
          sCtx.lineWidth = brushSize;
          sCtx.lineCap = 'round';
          sCtx.lineJoin = 'round';
          sCtx.beginPath();
          if (lastPosRef.current) {
            sCtx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
          }
          sCtx.lineTo(x, y);
          sCtx.stroke();
        } else if (tool === 'highlighter') {
          sCtx.strokeStyle = color;
          sCtx.globalAlpha = 0.45;
          sCtx.lineWidth = brushSize * 2.5;
          sCtx.lineCap = 'square';
          sCtx.lineJoin = 'miter';
          sCtx.beginPath();
          if (lastPosRef.current) {
            sCtx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
          }
          sCtx.lineTo(x, y);
          sCtx.stroke();
        } else if (tool === 'spray') {
          spray(sCtx, x, y, brushSize, color);
        } else if (tool === 'calligraphy') {
          if (lastPosRef.current) {
            drawCalligraphy(sCtx, lastPosRef.current.x, lastPosRef.current.y, x, y, brushSize, color);
          }
        }
      }
      sCtx.restore();
      lastPosRef.current = { x, y };
      redrawVisibleCanvas();
    } else {
      // Shape Preview
      const previewFn = (ctx) => {
        ctx.save();
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
        ctx.fillStyle = color;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = tool === 'highlighter' ? 0.45 : 1.0;
        
        if (isEraser) {
          ctx.strokeStyle = paperColor;
          ctx.fillStyle = paperColor;
        }

        const startX = startPosRef.current.x;
        const startY = startPosRef.current.y;

        ctx.beginPath();
        if (shapeMode === 'line') {
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (shapeMode === 'arrow') {
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();

          const angle = Math.atan2(y - startY, x - startX);
          const arrowLength = Math.max(brushSize * 3, 12);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(
            x - arrowLength * Math.cos(angle - Math.PI / 6),
            y - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(x, y);
          ctx.lineTo(
            x - arrowLength * Math.cos(angle + Math.PI / 6),
            y - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        } else if (shapeMode === 'rectangle') {
          ctx.rect(startX, startY, x - startX, y - startY);
          if (isFilled && !isEraser) {
            ctx.fill();
          } else {
            ctx.stroke();
          }
        } else if (shapeMode === 'circle') {
          const rx = Math.abs(x - startX) / 2;
          const ry = Math.abs(y - startY) / 2;
          const cx = startX + (x - startX) / 2;
          const cy = startY + (y - startY) / 2;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          if (isFilled && !isEraser) {
            ctx.fill();
          } else {
            ctx.stroke();
          }
        }
        ctx.restore();
      };
      
      redrawVisibleCanvas(previewFn);
      lastPosRef.current = { x, y };
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const sCtx = strokesCtxRef.current;
    if (!sCtx) return;

    const startX = startPosRef.current?.x;
    const startY = startPosRef.current?.y;
    const lastX = lastPosRef.current?.x;
    const lastY = lastPosRef.current?.y;

    if (shapeMode !== 'freehand' && startX !== undefined && lastX !== undefined) {
      sCtx.save();
      sCtx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      sCtx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
      sCtx.fillStyle = color;
      sCtx.lineWidth = isEraser ? brushSize * 2.5 : brushSize;
      sCtx.lineCap = 'round';
      sCtx.lineJoin = 'round';
      sCtx.globalAlpha = tool === 'highlighter' ? 0.45 : 1.0;

      sCtx.beginPath();
      if (shapeMode === 'line') {
        sCtx.moveTo(startX, startY);
        sCtx.lineTo(lastX, lastY);
        sCtx.stroke();
      } else if (shapeMode === 'arrow') {
        sCtx.moveTo(startX, startY);
        sCtx.lineTo(lastX, lastY);
        sCtx.stroke();

        const angle = Math.atan2(lastY - startY, lastX - startX);
        const arrowLength = Math.max(brushSize * 3, 12);
        sCtx.beginPath();
        sCtx.moveTo(lastX, lastY);
        sCtx.lineTo(
          lastX - arrowLength * Math.cos(angle - Math.PI / 6),
          lastY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        sCtx.moveTo(lastX, lastY);
        sCtx.lineTo(
          lastX - arrowLength * Math.cos(angle + Math.PI / 6),
          lastY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        sCtx.stroke();
      } else if (shapeMode === 'rectangle') {
        sCtx.rect(startX, startY, lastX - startX, lastY - startY);
        if (isFilled && !isEraser) {
          sCtx.fill();
        } else {
          sCtx.stroke();
        }
      } else if (shapeMode === 'circle') {
        const rx = Math.abs(lastX - startX) / 2;
        const ry = Math.abs(lastY - startY) / 2;
        const cx = startX + (lastX - startX) / 2;
        const cy = startY + (lastY - startY) / 2;
        sCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (isFilled && !isEraser) {
          sCtx.fill();
        } else {
          sCtx.stroke();
        }
      }
      sCtx.restore();
    }

    redrawVisibleCanvas();

    // Push new committed state
    const state = sCtx.getImageData(0, 0, 640, 400);
    setUndoStack(prev => [...prev, state]);
    setRedoStack([]);

    startPosRef.current = null;
    lastPosRef.current = null;
  };

  const handleUndo = () => {
    if (undoStack.length <= 1) return;

    const newUndo = undoStack.slice(0, -1);
    const popped = undoStack[undoStack.length - 1];
    const prevState = newUndo[newUndo.length - 1];

    const sCtx = strokesCtxRef.current;
    if (sCtx && prevState) {
      sCtx.putImageData(prevState, 0, 0);
      setUndoStack(newUndo);
      setRedoStack(prev => [...prev, popped]);
      setTimeout(redrawVisibleCanvas, 0);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);

    const sCtx = strokesCtxRef.current;
    if (sCtx && nextState) {
      sCtx.putImageData(nextState, 0, 0);
      setUndoStack(prev => [...prev, nextState]);
      setRedoStack(newRedo);
      setTimeout(redrawVisibleCanvas, 0);
    }
  };

  const handleClear = () => {
    const sCtx = strokesCtxRef.current;
    if (sCtx) {
      sCtx.clearRect(0, 0, 640, 400);
      const state = sCtx.getImageData(0, 0, 640, 400);
      setUndoStack(prev => [...prev, state]);
      setRedoStack([]);
      setTimeout(redrawVisibleCanvas, 0);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `dino-sketch-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  const colorPresets = [
    { value: '#000000', label: 'Black' },
    { value: '#007aff', label: 'Blue' },
    { value: '#ff3b30', label: 'Red' },
    { value: '#34c759', label: 'Green' },
    { value: '#ff9500', label: 'Orange' },
  ];

  const paperColors = [
    { value: '#ffffff', label: 'White' },
    { value: '#fdf6e3', label: 'Cream' },
    { value: '#f0f8ff', label: 'Blue' },
    { value: '#1e1e1e', label: 'Dark' },
  ];

  const paperStyles = [
    { value: 'blank', label: 'Plain' },
    { value: 'grid', label: 'Grid' },
    { value: 'ruled', label: 'Ruled' },
    { value: 'dotted', label: 'Dotted' },
  ];

  const shapeModes = [
    { value: 'freehand', label: 'Freehand', icon: '✏️' },
    { value: 'line', label: 'Line', icon: '📏' },
    { value: 'arrow', label: 'Arrow', icon: '➡️' },
    { value: 'rectangle', label: 'Rectangle', icon: '⬜' },
    { value: 'circle', label: 'Circle', icon: '⚪' },
  ];

  const brushTools = [
    { value: 'pencil', label: 'Pen', icon: '🖋️' },
    { value: 'highlighter', label: 'Highlighter', icon: '🖍️' },
    { value: 'spray', label: 'Spray', icon: '💨' },
    { value: 'calligraphy', label: 'Calligraphy', icon: '✒️' },
  ];

  return (
    <div className="notes-draw-overlay" onClick={onClose}>
      <div className="notes-draw-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="notes-draw-header">
          <h3>🎨 Dino Sketchpad</h3>
          <button className="draw-close-btn" onClick={onClose} title="Close Sketchpad">✕</button>
        </div>

        <div className="notes-draw-toolbar">
          {/* Row 1: Brush & General settings */}
          <div className="draw-toolbar-row">
            <div className="draw-tool-group">
              {brushTools.map(t => (
                <button
                  key={t.value}
                  className={`draw-tool-btn icon-only ${tool === t.value && !isEraser ? 'active' : ''}`}
                  onClick={() => { setTool(t.value); setIsEraser(false); }}
                  title={t.label}
                >
                  {t.icon}
                </button>
              ))}
              <button
                className={`draw-tool-btn icon-only ${isEraser ? 'active' : ''}`}
                onClick={() => setIsEraser(true)}
                title="Eraser"
              >
                🧽
              </button>
            </div>

            <div className="draw-divider" />

            {!isEraser && (
              <>
                <div className="draw-tool-group">
                  {colorPresets.map(preset => (
                    <button
                      key={preset.value}
                      className={`draw-color-swatch ${color === preset.value ? 'selected' : ''}`}
                      style={{ backgroundColor: preset.value }}
                      onClick={() => setColor(preset.value)}
                      title={preset.label}
                    />
                  ))}
                  
                  <div className="draw-color-picker-wrapper" title="Custom Color">
                    <input 
                      type="color" 
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </div>
                </div>
                <div className="draw-divider" />
              </>
            )}

            <div className="draw-tool-group size-group">
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--pixel-text-dim)' }}>
                Size: {brushSize}px
              </span>
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                style={{ width: '80px' }}
              />
            </div>

            <div className="draw-divider" style={{ marginLeft: 'auto' }} />

            <div className="draw-tool-group">
              <button 
                className="draw-tool-btn icon-only"
                onClick={handleUndo} 
                disabled={undoStack.length <= 1} 
                title="Undo last stroke"
              >
                ↩
              </button>
              <button 
                className="draw-tool-btn icon-only"
                onClick={handleRedo} 
                disabled={redoStack.length === 0} 
                title="Redo stroke"
              >
                ↪
              </button>
              <button 
                className="draw-tool-btn icon-only"
                onClick={handleClear} 
                title="Clear canvas"
                style={{ color: 'var(--pixel-red)', borderColor: 'var(--pixel-border)' }}
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Row 2: Shapes & Background settings */}
          <div className="draw-toolbar-row">
            <div className="draw-tool-group">
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--pixel-text-muted)', marginRight: 4 }}>Draw Shape:</span>
              {shapeModes.map(sm => (
                <button
                  key={sm.value}
                  className={`draw-tool-btn icon-only ${shapeMode === sm.value ? 'active' : ''}`}
                  onClick={() => setShapeMode(sm.value)}
                  title={sm.label}
                >
                  {sm.icon}
                </button>
              ))}

              {(shapeMode === 'rectangle' || shapeMode === 'circle') && (
                <label className="draw-fill-toggle" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, color: 'var(--pixel-text-dim)' }}>
                  <input
                    type="checkbox"
                    checked={isFilled}
                    onChange={(e) => setIsFilled(e.target.checked)}
                    style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                  />
                  Fill Shape
                </label>
              )}
            </div>

            <div className="draw-divider" />

            <div className="draw-tool-group">
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--pixel-text-muted)', marginRight: 4 }}>Paper Color:</span>
              {paperColors.map(c => (
                <button
                  key={c.value}
                  className={`draw-paper-color-swatch ${paperColor === c.value ? 'selected' : ''}`}
                  style={{
                    backgroundColor: c.value,
                    border: c.value === '#ffffff' && paperColor !== c.value ? '1px solid var(--pixel-border)' : (paperColor === c.value ? '2px solid var(--pixel-cyan)' : '1px solid transparent'),
                    width: '22px',
                    height: '22px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    padding: 0,
                    boxSizing: 'border-box'
                  }}
                  onClick={() => setPaperColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>

            <div className="draw-divider" />

            <div className="draw-tool-group">
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--pixel-text-muted)', marginRight: 4 }}>Paper Style:</span>
              {paperStyles.map(ps => (
                <button
                  key={ps.value}
                  className={`draw-tool-btn ${paperStyle === ps.value ? 'active' : ''}`}
                  onClick={() => setPaperStyle(ps.value)}
                  title={ps.label}
                  style={{ padding: '3px 8px', fontSize: '0.7rem', height: '26px' }}
                >
                  {ps.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="notes-draw-canvas-container">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ backgroundColor: paperColor }}
          />
        </div>

        <div className="notes-draw-footer">
          <button className="draw-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="draw-btn-save" style={{ background: 'var(--pixel-orange)', borderColor: 'var(--pixel-orange)', color: '#fff', marginRight: 'auto' }} onClick={handleDownload}>
            💾 Download PNG
          </button>
          <button className="draw-btn-save" onClick={handleSave}>
            Insert Sketch
          </button>
        </div>
      </div>
    </div>
  );
}
