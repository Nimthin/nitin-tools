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

  const data = await response.json();

  if (data.status !== 'success') {
    throw new Error(data.message || 'Download failed');
  }

  // Create an invisible iframe to trigger the download without opening a new tab
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = data.url;
  document.body.appendChild(iframe);
  
  // Clean up the iframe after a short delay
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 5000);
}
