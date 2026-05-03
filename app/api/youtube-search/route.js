import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    const html = await res.text();
    
    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if(match) {
      const data = JSON.parse(match[1]);
      const contents = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents;
      const results = contents.filter(c => c.videoRenderer).map(c => {
        const v = c.videoRenderer;
        return {
          videoId: v.videoId,
          title: v.title.runs[0].text,
          thumbnail: v.thumbnail.thumbnails[v.thumbnail.thumbnails.length - 1].url,
          channel: v.ownerText?.runs[0]?.text || '',
          duration: v.lengthText ? v.lengthText.simpleText : ''
        };
      }).slice(0, 3);
      
      if (results.length > 0) {
        return NextResponse.json({ results });
      }
    }

    return NextResponse.json({ error: 'No videos found for this search' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
