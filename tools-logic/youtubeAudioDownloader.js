/**
 * YouTube Audio Downloader — Tool Logic
 * Uses our own yt-dlp backend to extract audio streams
 */

// Backend URL — change this after deploying to Render
const API_URL = process.env.NEXT_PUBLIC_YT_API_URL || 'http://localhost:5000';

/**
 * Available audio quality options
 */
export const QUALITY_OPTIONS = [
  { value: '320', label: '320 kbps', description: 'Best quality', badge: 'HQ' },
  { value: '256', label: '256 kbps', description: 'High quality', badge: null },
  { value: '192', label: '192 kbps', description: 'Standard', badge: null },
  { value: '128', label: '128 kbps', description: 'Compact', badge: null },
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
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]+)/
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
 * Fetch video information (fast)
 */
export async function getVideoInfo(url) {
  const response = await fetch(`${API_URL}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
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
export async function downloadAudio(url, bitrate, title = 'audio') {
  const response = await fetch(`${API_URL}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim(), bitrate }),
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Download failed');
    } catch {
      throw new Error(`Download failed with status ${response.status}`);
    }
  }

  // Handle file download
  const blob = await response.blob();
  
  // Try to get filename from Content-Disposition header
  let filename = `${title}.mp3`;
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
          description: 'MP3 Audio File',
          accept: { 'audio/mpeg': ['.mp3'] },
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
