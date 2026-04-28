import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import { Readable } from 'stream';

export const maxDuration = 60;

const REQUEST_OPTS = {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, url } = body;

    if (!url || !ytdl.validateURL(url)) {
      return NextResponse.json(
        { status: 'error', message: 'Please enter a valid YouTube URL.' },
        { status: 400 }
      );
    }

    if (action === 'info') {
      return await handleInfo(url);
    }

    if (action === 'download') {
      return await handleDownload(url);
    }

    return NextResponse.json(
      { status: 'error', message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('YouTube API error:', error.message);
    return buildErrorResponse(error);
  }
}

// ── Info handler ─────────────────────────────────────────────────────
async function handleInfo(url) {
  const info = await getInfoWithRetry(url);
  const d = info.videoDetails;
  const thumb =
    d.thumbnails?.[d.thumbnails.length - 1]?.url || null;

  return NextResponse.json({
    status: 'success',
    title: d.title,
    author: d.author?.name || 'Unknown',
    duration: parseInt(d.lengthSeconds) || 0,
    thumbnail: thumb,
  });
}

// ── Download handler ─────────────────────────────────────────────────
async function handleDownload(url) {
  const info = await getInfoWithRetry(url);
  const title = info.videoDetails.title;
  const safeTitle =
    title.replace(/[^\w\s\-()[\]]/g, '').trim() || 'audio';

  // Pick best audio-only format
  const audioFormats = ytdl
    .filterFormats(info.formats, 'audioonly')
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

  if (!audioFormats.length) {
    return NextResponse.json(
      { status: 'error', message: 'No audio streams found for this video.' },
      { status: 404 }
    );
  }

  const best = audioFormats[0];
  const ext = (best.container || 'mp4').replace('webm', 'weba');

  // Stream audio through serverless function
  const stream = ytdl.downloadFromInfo(info, {
    format: best,
    requestOptions: REQUEST_OPTS,
  });

  const webStream = Readable.toWeb(stream);

  return new Response(webStream, {
    headers: {
      'Content-Type': best.mimeType?.split(';')[0] || 'audio/mp4',
      'Content-Disposition': `attachment; filename="${safeTitle}.${ext}"`,
      ...(best.contentLength && {
        'Content-Length': best.contentLength,
      }),
    },
  });
}

// ── Retry wrapper ────────────────────────────────────────────────────
async function getInfoWithRetry(url, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ytdl.getInfo(url, { requestOptions: REQUEST_OPTS });
    } catch (err) {
      lastError = err;
      console.error(`Attempt ${i + 1} failed:`, err.message);
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

// ── Error mapper ─────────────────────────────────────────────────────
function buildErrorResponse(error) {
  const msg = error.message || '';

  if (msg.includes('private') || msg.includes('unavailable'))
    return NextResponse.json(
      { status: 'error', message: 'This video is private or unavailable.' },
      { status: 404 }
    );

  if (msg.includes('age'))
    return NextResponse.json(
      { status: 'error', message: 'Age-restricted videos are not supported.' },
      { status: 403 }
    );

  if (msg.includes('Sign in') || msg.includes('bot'))
    return NextResponse.json(
      {
        status: 'error',
        message:
          'YouTube is temporarily blocking requests. Please try again in a moment.',
      },
      { status: 429 }
    );

  return NextResponse.json(
    { status: 'error', message: 'Could not process this video. Please try a different link.' },
    { status: 500 }
  );
}
