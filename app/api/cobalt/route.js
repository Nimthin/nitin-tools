import { NextResponse } from 'next/server';

export const maxDuration = 60;

const RAPIDAPI_KEY = '61b5bb9b0emshf345bd84b77ff20p13d077jsn9b84d99ec459';
const RAPIDAPI_HOST = 'youtube-mp36.p.rapidapi.com';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, url } = body;

    if (!url) {
      return NextResponse.json(
        { status: 'error', message: 'Please enter a valid YouTube URL.' },
        { status: 400 }
      );
    }

    // Extract Video ID
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]+)/);
    const videoId = match ? match[1] : null;

    if (!videoId) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    // Since the API returns everything (info + download link) in one call, 
    // we just fetch it from RapidAPI for both "info" and "download" actions
    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });

    const data = await response.json();

    if (data.status !== 'ok' || data.msg !== 'success') {
      return NextResponse.json(
        { status: 'error', message: data.msg || 'API Error' },
        { status: 500 }
      );
    }

    if (action === 'info') {
      return NextResponse.json({
        status: 'success',
        title: data.title,
        author: 'YouTube', // API doesn't return author, default to YouTube
        duration: Math.round(data.duration || 0),
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      });
    }

    if (action === 'download') {
      return NextResponse.json({
        status: 'success',
        title: data.title,
        url: data.link
      });
    }

    return NextResponse.json({ status: 'error', message: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('RapidAPI error:', error.message);
    return NextResponse.json(
      { status: 'error', message: 'Could not process this video. Please try again.' },
      { status: 500 }
    );
  }
}

