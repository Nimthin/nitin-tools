import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow enough time for scraping

// Helper to run fetch with a timeout
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 12000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// 1. Native Snapchat Scraper
async function scrapeSnapchat(snapUrl) {
  try {
    const res = await fetchWithTimeout(snapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });
    if (!res.ok) return null;
    const html = await res.text();
    
    // Look for contentUrl or og:video or direct video source
    const videoMatch = html.match(/contentUrl["']:\s*["']([^"']+)["']/i) ||
                       html.match(/<meta\s+property=["']og:video:secure_url["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<video[^>]*src=["']([^"']+)["']/i);
                       
    if (videoMatch) {
      let rawUrl = videoMatch[1];
      // Clean unicode escapes if present
      rawUrl = rawUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
      return rawUrl;
    }
    return null;
  } catch (e) {
    console.error('Snapchat native scraper failed:', e.message);
    return null;
  }
}

// 2. Publer Free Scraper API (Fallback for Pinterest, Instagram, Facebook, YouTube)
async function scrapeViaPubler(targetUrl) {
  try {
    const res = await fetchWithTimeout('https://api.publer.io/hooks/media', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://publer.io',
        'Referer': 'https://publer.io/'
      },
      body: JSON.stringify({ url: targetUrl }),
      timeout: 15000
    });

    if (!res.ok) return null;
    const data = await res.json();
    
    // Publer response formats:
    // It returns an array in data.payload or data
    const payload = data.payload || data;
    if (Array.isArray(payload) && payload.length > 0) {
      // Find the first video or image link
      const videoItem = payload.find(item => item.type === 'video');
      const item = videoItem || payload[0];
      if (item && item.path) {
        return item.path;
      }
    }
    return null;
  } catch (e) {
    console.error('Publer scraper API failed:', e.message);
    return null;
  }
}

// 3. Cobalt Free Community Nodes Fallback
const COBALT_NODES = [
  'https://cobalt.es',
  'https://cobalt.rot13.org',
  'https://cobalt.kudo.fun',
  'https://co.dispp.li'
];

async function scrapeViaCobalt(targetUrl) {
  for (const node of COBALT_NODES) {
    try {
      const res = await fetchWithTimeout(`${node}/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({
          url: targetUrl,
          videoQuality: '720'
        }),
        timeout: 8000
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) return data.url;
      }
    } catch (e) {
      console.warn(`Cobalt node ${node} failed:`, e.message);
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ status: 'error', message: 'URL is required' }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return NextResponse.json({ status: 'error', message: 'Please enter a valid HTTP/HTTPS link.' }, { status: 400 });
    }

    const lowerUrl = trimmedUrl.toLowerCase();

    // Block TikTok
    if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('douyin.com') || lowerUrl.includes('tiktokv.com')) {
      return NextResponse.json({ status: 'error', message: 'TikTok downloads are not supported by this tool.' }, { status: 400 });
    }

    // Identify platform
    const isInstagram = lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am');
    const isYouTube = lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be');
    const isSnapchat = lowerUrl.includes('snapchat.com');
    const isPinterest = lowerUrl.includes('pinterest.com') || lowerUrl.includes('pin.it');
    const isFacebook = lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerUrl.includes('fb.com');

    if (!isInstagram && !isYouTube && !isSnapchat && !isPinterest && !isFacebook) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Please enter a link from a supported platform (Instagram, YouTube, Snapchat, Pinterest, or Facebook).' 
      }, { status: 400 });
    }

    let downloadUrl = null;

    // 1. Try Snapchat natively first
    if (isSnapchat) {
      downloadUrl = await scrapeSnapchat(trimmedUrl);
    }

    // 2. Try Publer API (highly reliable keyless multi-platform downloader)
    if (!downloadUrl) {
      downloadUrl = await scrapeViaPubler(trimmedUrl);
    }

    // 3. Try Cobalt community nodes
    if (!downloadUrl) {
      downloadUrl = await scrapeViaCobalt(trimmedUrl);
    }

    if (downloadUrl) {
      return NextResponse.json({
        status: 'success',
        data: {
          status: 'redirect',
          url: downloadUrl
        }
      });
    }

    return NextResponse.json({
      status: 'error',
      message: 'Could not extract download link. Make sure the video is public and try again.'
    }, { status: 400 });

  } catch (error) {
    console.error('Social downloader error:', error);
    return NextResponse.json({
      status: 'error',
      message: `Internal server error: ${error.message}`
    }, { status: 500 });
  }
}
