import { PDFDocument } from 'pdf-lib';

/**
 * Load a PDF file and return its bytes and page count.
 * @param {File} file - The PDF file from file input
 * @returns {Promise<{ pdfBytes: ArrayBuffer, pageCount: number, fileName: string, fileSize: number }>}
 */
export async function loadPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  // Store as Uint8Array copy — ArrayBuffer can get detached after PDFDocument.load()
  const pdfBytes = new Uint8Array(arrayBuffer);
  const pdfDoc = await PDFDocument.load(pdfBytes.slice().buffer);
  return {
    pdfBytes: pdfBytes,
    pageCount: pdfDoc.getPageCount(),
    fileName: file.name,
    fileSize: file.size,
  };
}

/**
 * Remove specified pages from a PDF.
 * @param {ArrayBuffer} pdfBytes - The original PDF bytes
 * @param {Set<number>} pagesToRemove - Set of 0-indexed page numbers to remove
 * @returns {Promise<Uint8Array>} - The modified PDF bytes
 */
export async function removePages(pdfBytes, pagesToRemove) {
  // Create a fresh copy to avoid detached buffer issues
  const bytesCopy = new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(bytesCopy.buffer);
  const totalPages = pdfDoc.getPageCount();

  // Remove pages from end to start to keep indices consistent
  const sortedDesc = Array.from(pagesToRemove).sort((a, b) => b - a);

  for (const pageIndex of sortedDesc) {
    if (pageIndex >= 0 && pageIndex < totalPages) {
      pdfDoc.removePage(pageIndex);
    }
  }

  return await pdfDoc.save();
}

/**
 * Trigger download of PDF bytes as a file.
 * @param {Uint8Array} pdfBytes - The PDF bytes to download
 * @param {string} originalName - Original file name
 */
export async function downloadPdf(pdfBytes, originalName) {
  const nameWithoutExt = originalName.replace(/\.pdf$/i, '');
  const suggestedName = `${nameWithoutExt}_modified.pdf`;

  // Desktop: Use File System Access API for "Save As" dialog
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedName,
        types: [
          {
            description: 'PDF Document',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(pdfBytes);
      await writable.close();
      return; // Success — exit early
    } catch (err) {
      // User cancelled the dialog or API failed — fall through to regular download
      if (err.name === 'AbortError') return; // User cancelled, do nothing
    }
  }

  // Mobile / Fallback: Regular download with .pdf extension
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = suggestedName;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format file size in human-readable form.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
