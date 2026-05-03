import { NextResponse } from 'next/server';

export const maxDuration = 60;

const RAPIDAPI_KEY = '61b5bb9b0emshf345bd84b77ff20p13d077jsn9b84d99ec459';
const RAPIDAPI_HOST = 'youtube-mp36.p.rapidapi.com';

export async function POST(request) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });

    const data = await response.json();

    if (data.status !== 'ok' || data.msg !== 'success') {
      return NextResponse.json({ error: data.msg || 'Conversion failed' }, { status: 500 });
    }

    return NextResponse.json({
      streamUrl: data.link,
      title: data.title,
      duration: Math.round(data.duration || 0)
    });

  } catch (error) {
    console.error('Audio stream error:', error.message);
    return NextResponse.json({ error: 'Failed to get audio stream' }, { status: 500 });
  }
}
