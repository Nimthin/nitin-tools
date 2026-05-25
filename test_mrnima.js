const { instagramDownload } = require('@mrnima/instagram-downloader');

async function main() {
  const reelUrl = 'https://www.instagram.com/reel/DC6BvV0Rj-A/';
  console.log(`Extracting media from: ${reelUrl}`);
  try {
    const data = await instagramDownload(reelUrl);
    console.log('Result Status:', data.status);
    console.log('Parsed Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Scraper error:', err.message);
  }
}

main();
