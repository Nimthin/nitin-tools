const { instagramGetUrl } = require('instagram-url-direct');

async function main() {
  const reelUrl = 'https://www.instagram.com/reel/DC6BvV0Rj-A/';
  console.log(`Extracting media using instagramGetUrl from: ${reelUrl}`);
  try {
    const data = await instagramGetUrl(reelUrl);
    console.log('Parsed Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Library error:', err.message);
  }
}

main();
