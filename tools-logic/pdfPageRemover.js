import { PDFDocument } from 'pdf-lib';
import { saveFileAs } from './saveFile';

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

  await saveFileAs(pdfBytes, suggestedName, {
    description: 'PDF Document',
    mimeType: 'application/pdf',
    extensions: ['.pdf'],
  });
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
