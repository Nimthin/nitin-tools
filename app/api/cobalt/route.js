import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

// Create a proper agent with browser-like headers
const agent = ytdl.createAgent(undefined, {
  localAddress: undefined,
});

export async function POST(request) {
  try {
    const { url, audioBitrate = '128' } = await request.json();

    if (!url || !ytdl.validateURL(url)) {
      return NextResponse.json(
        { status: 'error', error: { code: 'error.api.link.invalid' } },
        { status: 400 }
      );
    }

    // Fetch with retry logic
    let info;
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        info = await ytdl.getInfo(url, {
          agent,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          },
        });
        break; // Success, exit retry loop
      } catch (err) {
        lastError = err;
        console.error(`Attempt ${attempt + 1} failed:`, err.message);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    if (!info) {
      throw lastError || new Error('Failed after retries');
    }

    const videoDetails = info.videoDetails;

    // Get audio-only formats
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

    if (!audioFormats.length) {
      return NextResponse.json(
        { status: 'error', error: { code: 'error.api.content.video.unavailable' } },
        { status: 404 }
      );
    }

    // Sort by bitrate descending
    const sorted = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    const title = videoDetails.title.replace(/[^\w\s\-()[\]]/g, '').trim();

    return NextResponse.json({
      status: 'success',
      title: videoDetails.title,
      author: videoDetails.author?.name || 'Unknown',
      duration: videoDetails.lengthSeconds,
      thumbnail: videoDetails.thumbnails?.[videoDetails.thumbnails.length - 1]?.url || null,
      availableQualities: sorted.map((f) => ({
        bitrate: f.audioBitrate,
        format: f.container,
        codec: f.audioCodec,
        size: f.contentLength ? Math.round(parseInt(f.contentLength) / 1024 / 1024 * 100) / 100 : null,
        url: f.url,
      })),
    });
  } catch (error) {
    console.error('YouTube API error:', error.message);

    if (error.message?.includes('private') || error.message?.includes('unavailable')) {
      return NextResponse.json(
        { status: 'error', error: { code: 'error.api.content.video.unavailable' } },
        { status: 404 }
      );
    }

    if (error.message?.includes('age')) {
      return NextResponse.json(
        { status: 'error', error: { code: 'error.api.content.video.age' } },
        { status: 403 }
      );
    }

    if (error.message?.includes('decipher') || error.message?.includes('playable')) {
      return NextResponse.json(
        { status: 'error', error: { code: 'error.api.youtube.decipher' } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { status: 'error', error: { code: 'error.api.fetch.fail' } },
      { status: 500 }
    );
  }
}
