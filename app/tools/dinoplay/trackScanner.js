'use client';

/**
 * 🦖 DinoPlay Track Scanner
 * Uses MediaInfo.js for instant track detection (no SharedArrayBuffer required)
 * Uses FFmpeg.wasm for subtitle/audio extraction when needed
 */

// ── MediaInfo-based Track Detection ──────────────────────────

function loadMediaInfoScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('MediaInfo can only be loaded in the browser.'));
      return;
    }
    if (window.MediaInfo) {
      const factory = window.MediaInfo.mediaInfoFactory || window.MediaInfo.default || window.MediaInfo;
      resolve(factory);
      return;
    }
    // Check if script is already appended
    const existing = document.querySelector('script[src*="mediainfo"]');
    if (existing) {
      existing.addEventListener('load', () => {
        const factory = window.MediaInfo.mediaInfoFactory || window.MediaInfo.default || window.MediaInfo;
        resolve(factory);
      });
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.src = '/mediainfo/mediainfo.min.js';
    script.async = true;
    script.onload = () => {
      if (window.MediaInfo) {
        const factory = window.MediaInfo.mediaInfoFactory || window.MediaInfo.default || window.MediaInfo;
        resolve(factory);
      } else {
        reject(new Error('MediaInfo loaded but global window.MediaInfo not found.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load local MediaInfo.js script.'));
    document.body.appendChild(script);
  });
}

/**
 * Scans a video File object for embedded audio and subtitle tracks.
 * Uses MediaInfo.js which is fast, lightweight, and doesn't require SharedArrayBuffer.
 */
export async function scanTracks(file, onProgress) {
  if (!file) return { audioTracks: [], subtitleTracks: [] };

  try {
    if (onProgress) onProgress('Loading media scanner...');

    const MediaInfoFactory = await loadMediaInfoScript();
    const mi = await MediaInfoFactory({
      format: 'object',
      locateFile: (path, prefix) => {
        // Use local WASM binary from the public directory
        if (path.endsWith('.wasm')) {
          return '/mediainfo/MediaInfoModule.wasm';
        }
        return prefix + path;
      },
    });

    if (onProgress) onProgress('Scanning tracks...');

    // MediaInfo reads file in chunks via a callback
    const fileSize = file.size;
    const readChunk = (chunkSize, offset) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target.error) {
            reject(e.target.error);
            return;
          }
          resolve(new Uint8Array(e.target.result));
        };
        reader.onerror = reject;
        const end = Math.min(offset + chunkSize, fileSize);
        reader.readAsArrayBuffer(file.slice(offset, end));
      });
    };

    const result = await mi.analyzeData(fileSize, readChunk);
    mi.close();

    if (onProgress) onProgress(null);

    return parseMediaInfoResult(result);
  } catch (err) {
    console.error('Track scanning failed:', err);
    if (onProgress) onProgress(null);
    return { audioTracks: [], subtitleTracks: [], error: err.message };
  }
}

/**
 * Parses MediaInfo's result object into our standardized track format.
 */
function parseMediaInfoResult(result) {
  const audioTracks = [];
  const subtitleTracks = [];

  if (!result?.media?.track) {
    return { audioTracks, subtitleTracks };
  }

  let audioIndex = 0;
  let subIndex = 0;

  for (const track of result.media.track) {
    if (track['@type'] === 'Audio') {
      const lang = track.Language || 'und';
      const codec = track.Format || track.CodecID || 'Unknown';
      const channels = track.Channels 
        ? (track.Channels === '2' ? 'stereo' : track.Channels === '1' ? 'mono' : `${track.Channels}ch`) 
        : '';
      const sampleRate = track.SamplingRate ? `${track.SamplingRate} Hz` : '';
      const title = track.Title || '';
      const streamIndex = track.StreamOrder != null ? parseInt(track.StreamOrder) : audioIndex;

      audioTracks.push({
        index: streamIndex,
        language: lang,
        codec,
        channels,
        sampleRate,
        title,
        label: buildTrackLabel('Audio', audioIndex, lang, codec, channels, title),
      });
      audioIndex++;
    } else if (track['@type'] === 'Text') {
      const lang = track.Language || 'und';
      const codec = track.Format || track.CodecID || 'Unknown';
      const title = track.Title || '';
      const streamIndex = track.StreamOrder != null ? parseInt(track.StreamOrder) : subIndex;
      const forced = track.Forced === 'Yes';
      const isDefault = track.Default === 'Yes';

      subtitleTracks.push({
        index: streamIndex,
        language: lang,
        codec,
        title,
        forced,
        default: isDefault,
        label: buildTrackLabel('Subtitle', subIndex, lang, codec, null, title, forced),
      });
      subIndex++;
    }
  }

  return { audioTracks, subtitleTracks };
}

/**
 * Builds a human-readable label like "Track 1 - English (AAC, stereo)"
 */
function buildTrackLabel(type, index, lang, codec, channels, title, forced) {
  const langMap = {
    en: 'English', hi: 'Hindi', ja: 'Japanese', ko: 'Korean',
    es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
    pt: 'Portuguese', ru: 'Russian', ar: 'Arabic', zh: 'Chinese',
    ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi',
    th: 'Thai', vi: 'Vietnamese', pl: 'Polish', nl: 'Dutch',
    sv: 'Swedish', da: 'Danish', fi: 'Finnish', no: 'Norwegian',
    und: 'Unknown', mul: 'Multiple',
    // 3-letter codes
    eng: 'English', hin: 'Hindi', jpn: 'Japanese', kor: 'Korean',
    spa: 'Spanish', fre: 'French', ger: 'German', ita: 'Italian',
    por: 'Portuguese', rus: 'Russian', ara: 'Arabic', chi: 'Chinese',
    tam: 'Tamil', tel: 'Telugu', ben: 'Bengali', mar: 'Marathi',
  };

  const langClean = lang?.toLowerCase().split('-')[0] || 'und';
  const langName = langMap[langClean] || lang || 'Unknown';

  // If the track has a title, use it as the primary label
  if (title) {
    let label = `${title}`;
    if (forced) label += ' [Forced]';
    return label;
  }

  let label = `${langName}`;
  const details = [];
  if (codec) details.push(codec);
  if (channels) details.push(channels);
  if (details.length > 0) label += ` (${details.join(', ')})`;
  if (forced) label += ' [Forced]';

  return label;
}


// ── FFmpeg-based Track Extraction ────────────────────────────

let ffmpegInstance = null;
let ffmpegLoadPromise = null;
let activeLogCallback = null;

// Max file size for in-memory operations (2GB)
const MAX_MEM_SIZE = 2 * 1024 * 1024 * 1024;

/**
 * Lazily loads and caches the FFmpeg.wasm instance.
 * Only used for extraction, not scanning.
 */
async function getFFmpeg() {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const ff = new FFmpeg();

      // Register global log dispatcher
      ff.on('log', (event) => {
        const msg = typeof event === 'string' ? event : event?.message;
        if (activeLogCallback && msg) {
          activeLogCallback(msg);
        }
      });

      await ff.load({
        coreURL: '/ffmpeg/ffmpeg-core-umd.js',
        wasmURL: '/ffmpeg/ffmpeg-core-umd.wasm',
      });
      ffmpegInstance = ff;
      return ff;
    })();
  }
  return ffmpegLoadPromise;
}

/**
 * Extracts a specific subtitle track from the video file.
 * Returns a Blob URL to the extracted .vtt subtitle file.
 */
export async function extractSubtitle(file, trackIndex, onProgress) {
  if (file.size > MAX_MEM_SIZE) {
    alert(`File is too large (${Math.round(file.size / 1024 / 1024)}MB) to load into browser memory. Limit is 2GB.`);
    return null;
  }

  activeLogCallback = (msg) => {
    console.log('[FFmpeg Subtitle Extract]', msg);
    if (onProgress) onProgress('Extracting subtitle...', msg);
  };

  try {
    if (onProgress) onProgress('Loading FFmpeg...');
    const ff = await getFFmpeg();
    const { fetchFile } = await import('@ffmpeg/util');

    if (onProgress) onProgress('Reading video file...');
    const fileData = await fetchFile(file);

    const inputName = 'input_sub' + getExtension(file.name);
    await ff.writeFile(inputName, fileData);

    if (onProgress) onProgress('Extracting subtitle track...');

    const outputName = `subtitle_${trackIndex}.srt`;

    await ff.exec([
      '-i', inputName,
      '-map', `0:${trackIndex}`,
      '-f', 'srt',
      outputName
    ]);

    const data = await ff.readFile(outputName);

    // Convert SRT to WebVTT
    let srtText = new TextDecoder().decode(data);
    srtText = srtText.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
    const vttText = 'WEBVTT\n\n' + srtText;

    const blob = new Blob([vttText], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);

    // Cleanup
    try { await ff.deleteFile(inputName); } catch (e) {}
    try { await ff.deleteFile(outputName); } catch (e) {}

    if (onProgress) onProgress(null);
    return url;
  } catch (err) {
    console.error('Subtitle extraction failed:', err);
    if (onProgress) onProgress(null);
    return null;
  } finally {
    activeLogCallback = null;
  }
}

/**
 * Extracts a specific audio track from the video file.
 * Returns a Blob URL to the extracted audio file.
 */
export async function extractAudio(file, trackIndex, onProgress) {
  if (file.size > MAX_MEM_SIZE) {
    alert(`File is too large (${Math.round(file.size / 1024 / 1024)}MB) to load into browser memory. Limit is 2GB.`);
    return null;
  }

  activeLogCallback = (msg) => {
    console.log('[FFmpeg Audio Extract]', msg);
    if (onProgress) onProgress('Extracting audio track...', msg);
  };

  try {
    if (onProgress) onProgress('Loading FFmpeg...');
    const ff = await getFFmpeg();
    const { fetchFile } = await import('@ffmpeg/util');

    if (onProgress) onProgress('Reading video file...');
    const fileData = await fetchFile(file);

    const inputName = 'input_audio' + getExtension(file.name);
    await ff.writeFile(inputName, fileData);

    if (onProgress) onProgress('Extracting audio track (this may take a moment)...');

    const outputName = `audio_${trackIndex}.mp3`;

    await ff.exec([
      '-i', inputName,
      '-map', `0:${trackIndex}`,
      '-vn',          // No video
      '-acodec', 'libmp3lame',
      '-q:a', '2',    // Good quality
      outputName
    ]);

    const data = await ff.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    // Cleanup
    try { await ff.deleteFile(inputName); } catch (e) {}
    try { await ff.deleteFile(outputName); } catch (e) {}

    if (onProgress) onProgress(null);
    return url;
  } catch (err) {
    console.error('Audio extraction failed:', err);
    if (onProgress) onProgress(null);
    return null;
  } finally {
    activeLogCallback = null;
  }
}

function getExtension(filename) {
  const ext = filename.split('.').pop();
  return ext ? `.${ext}` : '.mkv';
}
