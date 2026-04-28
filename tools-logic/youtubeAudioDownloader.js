/**
 * YouTube Audio Downloader — Tool Logic
 * Uses Next.js API route (/api/cobalt) powered by @distube/ytdl-core.
 * No external backend required.
 */

/**
 * Available audio quality options (cosmetic labels — we always fetch best)
 */
export const QUALITY_OPTIONS = [
  { value: 'best', label: 'Best Quality', description: 'Highest available', badge: 'HQ' },
];

/**
 * Validate a YouTube URL
 */
export function isValidYouTubeUrl(url) {
  if (!url) return false;
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^(https?:\/\/)?youtu\.be\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
    /^(https?:\/\/)?m\.youtube\.com\/watch\?v=[\w-]+/,
  ];
  return patterns.some((p) => p.test(url.trim()));
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\\w-]+)/
  );
  return match ? match[1] : null;
}

/**
 * Get YouTube thumbnail URL from video ID
 */
export function getThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Format duration from seconds to mm:ss or hh:mm:ss
 */
export function formatDuration(seconds) {
  const s = parseInt(seconds);
  if (isNaN(s)) return '--:--';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Fetch video information via our own API route (fast, no download)
 */
export async function getVideoInfo(url) {
  const response = await fetch('/api/cobalt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'info', url: url.trim() }),
  });

  const data = await response.json();

  if (data.status === 'error') {
    throw new Error(data.message || 'Failed to get video info');
  }

  return data;
}

/**
 * Request audio download and trigger saving
 */
export async function downloadAudio(url, _quality, title = 'audio') {
  const response = await fetch('/api/cobalt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'download', url: url.trim() }),
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Download failed');
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(`Download failed (status ${response.status})`);
      }
      throw e;
    }
  }

  // Handle file download
  const blob = await response.blob();

  // Try to get filename from Content-Disposition header
  let filename = `${title}.m4a`;
  const disposition = response.headers.get('Content-Disposition');
  if (disposition && disposition.includes('filename=')) {
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch && filenameMatch.length === 2) {
      filename = filenameMatch[1];
    }
  }

  // Use File System Access API if available to let the user pick the save path
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Audio File',
          accept: { 'audio/*': ['.m4a', '.weba', '.webm', '.mp4'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return; // Success, skip fallback
    } catch (err) {
      // If user cancelled the picker gently return without error
      if (err.name === 'AbortError') return;
      console.warn('Save picker failed, falling back to auto-download', err);
    }
  }

  // Fallback: Create Object URL and trigger standard browser download
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}
