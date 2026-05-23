import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get('prompt');
    const width = searchParams.get('width') || '768';
    const height = searchParams.get('height') || '768';
    const nologo = searchParams.get('nologo') || 'true';

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Properly encode the prompt to ensure it forms a valid URL
    const encodedPrompt = encodeURIComponent(decodeURIComponent(prompt));
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=${nologo}`;

    const response = await fetch(pollinationsUrl);

    if (!response.ok) {
      throw new Error(`Pollinations API returned status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch image from proxy' }, { status: 500 });
  }
}
