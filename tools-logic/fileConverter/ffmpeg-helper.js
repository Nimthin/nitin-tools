'use client';

let instance = null;
let loadPromise = null;

export function isFfmpegLoaded() {
  return !!instance?.loaded;
}

export async function getFfmpeg() {
  if (instance?.loaded) return instance;
  if (!loadPromise) {
    loadPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const ff = new FFmpeg();
      ff.on('log', () => {});
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      await ff.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      instance = ff;
      return ff;
    })();
  }
  return loadPromise;
}
