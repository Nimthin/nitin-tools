import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow enough time for proxy scraping/failovers

const FALLBACK_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt.api.ryz.cx',
  'https://co.wuk.sh',
  'https://cobalt.inst.host',
  'https://cobalt.q67.space',
  'https://cobalt.shinn.cc',
];

// Helper to run fetch with a timeout
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;
  
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

export async function POST(request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { status: 'error', message: 'URL is required' },
        { status: 400 }
      );
    }

    // Basic URL format validation
    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return NextResponse.json(
        { status: 'error', message: 'Please enter a valid HTTP/HTTPS link.' },
        { status: 400 }
      );
    }

    // Step 1: Get list of active Cobalt instances
    let instances = [];
    try {
      // Fetch the community tracker list with a timeout of 4s
      const listRes = await fetchWithTimeout('https://instances.cobalt.best/api/instances.json', { timeout: 4000 });
      if (listRes.ok) {
        const rawList = await listRes.json();
        if (Array.isArray(rawList)) {
          // Extract URLs, filter out invalid/offline ones if status/score is provided
          instances = rawList
            .filter(inst => {
              // Ensure it's online and potentially supports instagram
              const isOffline = inst.status === 'offline' || inst.score === 0;
              return !isOffline && (inst.url || inst.api || inst.domain);
            })
            .map(inst => inst.url || inst.api || (inst.domain ? `https://${inst.domain}` : null))
            .filter(Boolean);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch cobalt instances list, falling back to static list:', e.message);
    }

    // Merge dynamic instances with our fallback list and de-duplicate
    const allTargets = Array.from(new Set([...instances, ...FALLBACK_INSTANCES]));

    console.log(`Attempting downloader with ${allTargets.length} potential Cobalt instances...`);

    let downloadResult = null;
    let lastErrorMsg = 'All downloader nodes failed to process this link.';

    // Step 2: Try up to 4 instances sequentially
    const maxTries = Math.min(allTargets.length, 4);
    for (let i = 0; i < maxTries; i++) {
      const baseUrl = allTargets[i];
      // Clean up the URL to ensure no trailing slashes on root endpoint
      const targetEndpoint = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

      try {
        console.log(`[Try ${i + 1}/${maxTries}] Sending request to: ${targetEndpoint}`);
        
        const response = await fetchWithTimeout(targetEndpoint, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: trimmedUrl,
            videoQuality: '720',
            filenamePattern: 'pretty'
          }),
          timeout: 8000 // 8s timeout per instance
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // Cobalt success formats: 'redirect', 'tunnel', 'picker'
        if (data.status === 'redirect' || data.status === 'tunnel' || data.status === 'picker') {
          downloadResult = data;
          break; // Success! Exit loop
        } else if (data.status === 'error') {
          const errMsg = data.error?.code || data.error || 'Unknown error code';
          console.warn(`Instance ${baseUrl} returned error: ${errMsg}`);
          lastErrorMsg = `Downloader returned error: ${errMsg}`;
        }
      } catch (error) {
        console.warn(`Failed with instance ${baseUrl}:`, error.message);
        lastErrorMsg = error.message;
      }
    }

    // Step 3: Return result or final error
    if (downloadResult) {
      return NextResponse.json({
        status: 'success',
        data: downloadResult
      });
    }

    return NextResponse.json(
      { status: 'error', message: `Could not process this video link. (${lastErrorMsg})` },
      { status: 500 }
    );

  } catch (error) {
    console.error('Social downloader API exception:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
