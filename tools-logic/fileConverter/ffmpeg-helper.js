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
      await ff.load({
        coreURL: '/ffmpeg/ffmpeg-core-umd.js',
        wasmURL: '/ffmpeg/ffmpeg-core-umd.wasm',
      });
      instance = ff;
      return ff;
    })();
  }
  return loadPromise;
}
