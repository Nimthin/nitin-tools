'use client';

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import heic2any from 'heic2any';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { zipSync, unzipSync, strFromU8 } from 'fflate';
import { fetchFile } from '@ffmpeg/util';

import { getFfmpeg } from './ffmpeg-helper';

function stem(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  return pdfjs;
}

async function loadXlsx() {
  return import('xlsx');
}

async function extractPdfPageTexts(pdfBytes) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const texts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const parts = tc.items.map((it) => ('str' in it ? it.str : ''));
    texts.push(parts.join(' ').replace(/\s+/g, ' ').trim());
  }
  return texts;
}

async function pdfPageRendersToZip(pdfBytes, baseName, mime, ext) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const files = {};
  const q = mime === 'image/jpeg' ? 0.92 : undefined;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL(mime, q);
    const bin = atob(dataUrl.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
    files[`${baseName}_page_${i}.${ext}`] = arr;
  }
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' });
}

async function pdfToDocxBlob(pdfBytes) {
  const pages = await extractPdfPageTexts(pdfBytes);
  const children = [];
  for (const text of pages) {
    const lines = text ? text.split(/\n+/).filter(Boolean) : [''];
    for (const line of lines) {
      children.push(new Paragraph({ children: [new TextRun(line || ' ')] }));
    }
    children.push(new Paragraph({ text: '' }));
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function pdfToHtmlBlob(pdfBytes, baseName) {
  const pages = await extractPdfPageTexts(pdfBytes);
  const body = pages
    .map((t, i) => `<section><h2>Page ${i + 1}</h2><pre>${escapeHtml(t)}</pre></section>`)
    .join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(baseName)}</title></head><body>${body}</body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

async function textToPdfBlob(text) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const margin = 48;
  const lineHeight = fontSize * 1.2;
  const pageWidth = 595;
  const pageHeight = 842;
  const maxWidth = pageWidth - margin * 2;

  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n/);
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const flushLine = (line) => {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    const safe = line.length > 500 ? `${line.slice(0, 497)}…` : line;
    page.drawText(safe, { x: margin, y, size: fontSize, font, maxWidth });
    y -= lineHeight;
  };

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      flushLine(' ');
      continue;
    }
    let current = '';
    for (const w of paragraph.split(/\s+/)) {
      const test = current ? `${current} ${w}` : w;
      const wWidth = font.widthOfTextAtSize(test, fontSize);
      if (wWidth > maxWidth && current) {
        flushLine(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) flushLine(current);
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

async function textToDocxBlob(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const children = lines.map((line) => new Paragraph({ children: [new TextRun(line || ' ')] }));
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

async function htmlStringToPdfBlob(html, baseName) {
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.left = '-9999px';
  div.style.top = '0';
  div.style.width = '794px';
  div.style.padding = '24px';
  div.style.background = '#fff';
  div.style.color = '#111';
  div.innerHTML = html;
  document.body.appendChild(div);
  try {
    const canvas = await html2canvas(div, { scale: 1.5, useCORS: true, logging: false });
    const pdf = new jsPDF({
      unit: 'px',
      format: [canvas.width, canvas.height],
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
    return pdf.output('blob');
  } finally {
    document.body.removeChild(div);
  }
}

function htmlToPlainText(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  return d.body.textContent || '';
}

async function htmlToDocxFromString(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const children = [];
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.trim();
      if (t) children.push(new Paragraph({ children: [new TextRun(t)] }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName?.toLowerCase();
    if (['script', 'style'].includes(tag)) return;
    if (['h1', 'h2', 'h3'].includes(tag)) {
      const level =
        tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      children.push(
        new Paragraph({
          heading: level,
          children: [new TextRun(node.textContent?.trim() || '')],
        })
      );
      return;
    }
    if (tag === 'p' || tag === 'div') {
      const txt = node.textContent?.trim();
      if (txt) children.push(new Paragraph({ children: [new TextRun(txt)] }));
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(d.body);
  if (!children.length) {
    const t = d.body.textContent?.trim() || ' ';
    children.push(new Paragraph({ children: [new TextRun(t)] }));
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

function extractOdtText(arrayBuffer) {
  const data = unzipSync(new Uint8Array(arrayBuffer));
  const raw = data['content.xml'];
  if (!raw) throw new Error('This file does not look like a valid OpenDocument file.');
  const xml = strFromU8(raw);
  const NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const parts = [];
  const ps = doc.getElementsByTagNameNS(NS, 'p');
  const hs = doc.getElementsByTagNameNS(NS, 'h');
  for (let i = 0; i < hs.length; i++) {
    const t = hs[i].textContent?.trim();
    if (t) parts.push(t);
  }
  for (let i = 0; i < ps.length; i++) {
    const t = ps[i].textContent?.trim();
    if (t) parts.push(t);
  }
  return parts.join('\n\n');
}

function parseDelimited(text, delimiter) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length);
  return lines.map((line) => {
    if (delimiter === '\t') return line.split('\t');
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim().replace(/^"|"$/g, ''));
  });
}

async function tryMammothToHtml(arrayBuffer) {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

async function tryMammothRawText(arrayBuffer) {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function rasterToPdfFile(file) {
  const pdfDoc = await PDFDocument.create();
  const bytes = await file.arrayBuffer();
  const mime = file.type || '';
  let pdfImage;

  if (mime === 'image/jpeg' || mime === 'image/jpg' || file.name.toLowerCase().endsWith('.jpg')) {
    pdfImage = await pdfDoc.embedJpg(bytes);
  } else if (mime === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
    pdfImage = await pdfDoc.embedPng(bytes);
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const jpegBytes = await fetch(canvas.toDataURL('image/jpeg', 0.92)).then((r) => r.arrayBuffer());
      pdfImage = await pdfDoc.embedJpg(jpegBytes);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const { width, height } = pdfImage.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(pdfImage, { x: 0, y: 0, width, height });
  const out = await pdfDoc.save();
  return new Blob([out], { type: 'application/pdf' });
}

async function ffmpegTranscode(file, inExt, outExt, extraArgs = []) {
  const ff = await getFfmpeg();
  const id = `${Date.now()}`;
  const input = `in_${id}.${inExt}`;
  const output = `out_${id}.${outExt}`;
  await ff.writeFile(input, await fetchFile(file));
  await ff.exec(['-y', '-i', input, ...extraArgs, output]);
  const data = await ff.readFile(output);
  await ff.deleteFile(input).catch(() => {});
  await ff.deleteFile(output).catch(() => {});
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const mime = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    webm: 'video/webm',
    gif: 'image/gif',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
  }[outExt] || 'application/octet-stream';
  return new Blob([buf], { type: mime });
}

function jsonToCsvString(data) {
  if (Array.isArray(data) && data.length && typeof data[0] === 'object' && !Array.isArray(data[0])) {
    const keys = [...new Set(data.flatMap((o) => Object.keys(o)))];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [keys.join(',')];
    for (const row of data) {
      lines.push(keys.map((k) => esc(row[k])).join(','));
    }
    return lines.join('\n');
  }
  return `"value"\n${JSON.stringify(data).replace(/"/g, '""')}`;
}

function jsonToXmlString(data) {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true,
  });
  const wrapped = { root: data };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(wrapped)}`;
}

function xmlToJsonString(xmlStr) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    mergeAttrs: false,
    trimValues: true,
  });
  return JSON.stringify(parser.parse(xmlStr), null, 2);
}

function xmlToCsvHeuristic(xmlStr) {
  const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
  const obj = parser.parse(xmlStr);
  const rows = [];

  function collect(o) {
    if (Array.isArray(o)) {
      o.forEach(collect);
      return;
    }
    if (o && typeof o === 'object') {
      const vals = Object.values(o).filter((v) => v != null && typeof v !== 'object');
      if (vals.length === Object.keys(o).length && vals.length) {
        rows.push(o);
        return;
      }
      Object.values(o).forEach(collect);
    }
  }
  collect(obj);
  if (!rows.length) {
    return jsonToCsvString([{ xml: xmlStr.slice(0, 5000) }]);
  }
  return jsonToCsvString(rows);
}

/**
 * @param {File} file
 * @param {string} targetId
 * @param {{ category: string, ext: string }} detected
 */
export async function convertFile(file, targetId, detected) {
  const base = stem(file.name || 'download');
  const { category, ext: srcExt } = detected;

  if (category === 'pdf') {
    const buf = await file.arrayBuffer();
    if (targetId === 'docx') {
      const blob = await pdfToDocxBlob(buf);
      return { blob, filename: `${base}.docx` };
    }
    if (targetId === 'txt') {
      const pages = await extractPdfPageTexts(buf);
      const blob = new Blob([pages.join('\n\n')], { type: 'text/plain;charset=utf-8' });
      return { blob, filename: `${base}.txt` };
    }
    if (targetId === 'html') {
      const blob = await pdfToHtmlBlob(buf, base);
      return { blob, filename: `${base}.html` };
    }
    if (targetId === 'jpg_zip') {
      const blob = await pdfPageRendersToZip(buf, base, 'image/jpeg', 'jpg');
      return { blob, filename: `${base}_pages.zip` };
    }
    if (targetId === 'png_zip') {
      const blob = await pdfPageRendersToZip(buf, base, 'image/png', 'png');
      return { blob, filename: `${base}_pages.zip` };
    }
  }

  if (category === 'docx') {
    const buf = await file.arrayBuffer();
    if (targetId === 'txt') {
      const text = await tryMammothRawText(buf);
      return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: `${base}.txt` };
    }
    if (targetId === 'html') {
      const html = await tryMammothToHtml(buf);
      const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>${html}</body></html>`;
      return { blob: new Blob([doc], { type: 'text/html;charset=utf-8' }), filename: `${base}.html` };
    }
    if (targetId === 'pdf') {
      const html = await tryMammothToHtml(buf);
      const blob = await htmlStringToPdfBlob(html, base);
      return { blob, filename: `${base}.pdf` };
    }
  }

  if (category === 'doc') {
    const buf = await file.arrayBuffer();
    let html;
    try {
      html = await tryMammothToHtml(buf);
    } catch {
      throw new Error(
        'This .doc file could not be read here. Open it in Word or LibreOffice and save as .docx, then try again.'
      );
    }
    if (!html?.trim()) {
      throw new Error(
        'This .doc file has no readable content here. Save as .docx in Word/LibreOffice and upload again.'
      );
    }
    if (targetId === 'txt') {
      const text = htmlToPlainText(html);
      return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: `${base}.txt` };
    }
    if (targetId === 'pdf') {
      const blob = await htmlStringToPdfBlob(html, base);
      return { blob, filename: `${base}.pdf` };
    }
    if (targetId === 'docx') {
      const text = htmlToPlainText(html);
      const blob = await textToDocxBlob(text);
      return { blob, filename: `${base}.docx` };
    }
  }

  if (category === 'txt') {
    const text = await file.text();
    if (targetId === 'pdf') {
      const blob = await textToPdfBlob(text);
      return { blob, filename: `${base}.pdf` };
    }
    if (targetId === 'docx') {
      const blob = await textToDocxBlob(text);
      return { blob, filename: `${base}.docx` };
    }
  }

  if (category === 'html') {
    const html = await file.text();
    if (targetId === 'txt') {
      const t = htmlToPlainText(html);
      return { blob: new Blob([t], { type: 'text/plain;charset=utf-8' }), filename: `${base}.txt` };
    }
    if (targetId === 'docx') {
      const blob = await htmlToDocxFromString(html);
      return { blob, filename: `${base}.docx` };
    }
    if (targetId === 'pdf') {
      const blob = await htmlStringToPdfBlob(html, base);
      return { blob, filename: `${base}.pdf` };
    }
  }

  if (category === 'md') {
    const md = await file.text();
    const htmlBody = await marked.parse(md);
    if (targetId === 'html') {
      const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head><body>${htmlBody}</body></html>`;
      return { blob: new Blob([doc], { type: 'text/html;charset=utf-8' }), filename: `${base}.html` };
    }
    if (targetId === 'pdf') {
      const blob = await htmlStringToPdfBlob(String(htmlBody), base);
      return { blob, filename: `${base}.pdf` };
    }
  }

  if (category === 'odt') {
    const buf = await file.arrayBuffer();
    const text = extractOdtText(buf);
    if (targetId === 'pdf') {
      const blob = await textToPdfBlob(text);
      return { blob, filename: `${base}.pdf` };
    }
    if (targetId === 'docx') {
      const blob = await textToDocxBlob(text);
      return { blob, filename: `${base}.docx` };
    }
  }

  if (category === 'raster') {
    const out = targetId;
    if (out === 'pdf') {
      const blob = await rasterToPdfFile(file);
      return { blob, filename: `${base}.pdf` };
    }
    const inExt =
      srcExt === 'jpeg'
        ? 'jpg'
        : srcExt === 'tif'
          ? 'tif'
          : srcExt === 'tiff'
            ? 'tiff'
            : srcExt;
    let outExt = out === 'jpg' ? 'jpg' : out === 'tiff' ? 'tif' : out;
    const blob = await ffmpegTranscode(file, inExt, outExt);
    return { blob, filename: `${base}.${outExt}` };
  }

  if (category === 'gif' && targetId === 'mp4') {
    const blob = await ffmpegTranscode(file, 'gif', 'mp4', ['-movflags', 'faststart', '-pix_fmt', 'yuv420p']);
    return { blob, filename: `${base}.mp4` };
  }

  if (category === 'heic') {
    const type = targetId === 'jpg' ? 'image/jpeg' : 'image/png';
    const out = await heic2any({ blob: file, toType: type, quality: 0.92 });
    const b = Array.isArray(out) ? out[0] : out;
    const ext = targetId === 'jpg' ? 'jpg' : 'png';
    return { blob: b, filename: `${base}.${ext}` };
  }

  if (category === 'audio' && targetId.startsWith('audio_')) {
    const fmt = targetId.replace(/^audio_/, '');
    const blob = await ffmpegTranscode(file, srcExt, fmt);
    return { blob, filename: `${base}.${fmt}` };
  }

  if (category === 'video') {
    const ff = await getFfmpeg();
    const id = `${Date.now()}`;
    const input = `vin_${id}.${srcExt}`;

    if (targetId === 'video_audio_mp3') {
      await ff.writeFile(input, await fetchFile(file));
      const output = `aout_${id}.mp3`;
      await ff.exec(['-y', '-i', input, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', output]);
      const data = await ff.readFile(output);
      await ff.deleteFile(input).catch(() => {});
      await ff.deleteFile(output).catch(() => {});
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      return { blob: new Blob([buf], { type: 'audio/mpeg' }), filename: `${base}.mp3` };
    }

    if (targetId === 'video_gif') {
      await ff.writeFile(input, await fetchFile(file));
      const output = `gout_${id}.gif`;
      await ff.exec([
        '-y',
        '-i',
        input,
        '-t',
        '8',
        '-vf',
        'fps=8,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        '-loop',
        '0',
        output,
      ]);
      const data = await ff.readFile(output);
      await ff.deleteFile(input).catch(() => {});
      await ff.deleteFile(output).catch(() => {});
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      return { blob: new Blob([buf], { type: 'image/gif' }), filename: `${base}.gif` };
    }

    if (targetId === 'video_frames_zip') {
      await ff.writeFile(input, await fetchFile(file));
      const prefix = `frm_${id}_`;
      await ff.exec(['-y', '-i', input, '-vf', 'fps=1', `${prefix}%04d.png`]);
      const nodes = await ff.listDir('/');
      const names = nodes
        .filter((n) => !n.isDir && n.name.startsWith(prefix) && n.name.endsWith('.png'))
        .map((n) => n.name)
        .sort();
      const files = {};
      for (let i = 0; i < names.length; i++) {
        const data = await ff.readFile(names[i]);
        files[`${base}_frame_${i + 1}.png`] = new Uint8Array(data);
        await ff.deleteFile(names[i]).catch(() => {});
      }
      await ff.deleteFile(input).catch(() => {});
      if (!names.length) {
        throw new Error('Could not save still images from this video. Try a shorter file.');
      }
      return {
        blob: new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' }),
        filename: `${base}_frames.zip`,
      };
    }

    if (targetId.startsWith('video_')) {
      const fmt = targetId.replace(/^video_/, '');
      const blob = await ffmpegTranscode(file, srcExt, fmt);
      return { blob, filename: `${base}.${fmt}` };
    }
  }

  if (category === 'csv' || category === 'tsv') {
    const text = await file.text();
    const delim = category === 'tsv' ? '\t' : ',';
    const rows = parseDelimited(text, delim);
    const XLSX = await loadXlsx();

    const escCsvCell = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    if (targetId === 'tsv' && category === 'csv') {
      const tsv = rows.map((r) => r.map((c) => String(c).replace(/\t/g, ' ')).join('\t')).join('\n');
      return { blob: new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' }), filename: `${base}.tsv` };
    }
    if (targetId === 'csv' && category === 'tsv') {
      const csv = rows.map((r) => r.map(escCsvCell).join(',')).join('\n');
      return { blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename: `${base}.csv` };
    }
    if (targetId === 'json') {
      const headers = rows[0] || [];
      const objects =
        rows.length <= 1
          ? []
          : rows.slice(1).map((r) => {
              const o = {};
              headers.forEach((h, i) => {
                o[String(h || `col${i}`)] = r[i] ?? '';
              });
              return o;
            });
      return {
        blob: new Blob([JSON.stringify(objects, null, 2)], { type: 'application/json;charset=utf-8' }),
        filename: `${base}.json`,
      };
    }
    if (targetId === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      return {
        blob: new Blob([out], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        filename: `${base}.xlsx`,
      };
    }
    if (targetId === 'xls') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const out = XLSX.write(wb, { type: 'array', bookType: 'xls' });
      return { blob: new Blob([out], { type: 'application/vnd.ms-excel' }), filename: `${base}.xls` };
    }
  }

  if (category === 'json') {
    const raw = await file.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('This file is not valid JSON.');
    }
    if (targetId === 'xml') {
      const str = jsonToXmlString(data);
      return { blob: new Blob([str], { type: 'application/xml;charset=utf-8' }), filename: `${base}.xml` };
    }
    if (targetId === 'csv') {
      const str = jsonToCsvString(data);
      return { blob: new Blob([str], { type: 'text/csv;charset=utf-8' }), filename: `${base}.csv` };
    }
  }

  if (category === 'xml') {
    const xmlStr = await file.text();
    if (targetId === 'json') {
      const str = xmlToJsonString(xmlStr);
      return { blob: new Blob([str], { type: 'application/json;charset=utf-8' }), filename: `${base}.json` };
    }
    if (targetId === 'csv') {
      const str = xmlToCsvHeuristic(xmlStr);
      return { blob: new Blob([str], { type: 'text/csv;charset=utf-8' }), filename: `${base}.csv` };
    }
  }

  if (category === 'xlsx' || category === 'xls') {
    const XLSX = await loadXlsx();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    if (!wb.SheetNames?.length) throw new Error('This spreadsheet looks empty.');
    const first = wb.Sheets[wb.SheetNames[0]];

    if (targetId === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(first);
      return { blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename: `${base}.csv` };
    }
    if (targetId === 'xls' && category === 'xlsx') {
      const out = XLSX.write(wb, { type: 'array', bookType: 'xls' });
      return { blob: new Blob([out], { type: 'application/vnd.ms-excel' }), filename: `${base}.xls` };
    }
    if (targetId === 'xlsx' && category === 'xls') {
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      return {
        blob: new Blob([out], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        filename: `${base}.xlsx`,
      };
    }
  }

  throw new Error('This conversion could not be completed.');
}
