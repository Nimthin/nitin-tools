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
      const ver = '0.12.6';
      const base = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${ver}/dist/esm`;
      await ff.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      instance = ff;
      return ff;
    })();
  }
  return loadPromise;
}
