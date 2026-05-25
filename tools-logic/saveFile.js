/**
 * Save File Utility — "Save As" Dialog
 * Uses the File System Access API (showSaveFilePicker) on supported browsers
 * to let the user rename and choose the save location. Falls back to a regular
 * auto-download for mobile or unsupported browsers.
 *
 * @param {Blob|Uint8Array|ArrayBuffer} data - The file data to save
 * @param {string} suggestedName - Suggested filename (user can rename)
 * @param {{ description?: string, mimeType?: string, extensions?: string[] }} [opts]
 */
export async function saveFileAs(data, suggestedName, opts = {}) {
  const {
    description = 'File',
    mimeType = 'application/pdf',
    extensions = ['.pdf'],
  } = opts;

  // Ensure we have a Blob
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: mimeType });

  // Desktop: Use File System Access API for "Save As" dialog
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description,
            accept: { [mimeType]: extensions },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true; // saved successfully
    } catch (err) {
      // User cancelled the dialog — do nothing
      if (err.name === 'AbortError') return false;
      // API failed — fall through to fallback
      console.warn('showSaveFilePicker failed, falling back:', err.message);
    }
  }

  // Mobile / Fallback: Regular download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
