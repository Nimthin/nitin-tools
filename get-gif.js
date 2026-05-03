const fs = require('fs');
const https = require('https');

https.get('https://www.pinterest.com/pin/bots-have-feelings-too--9499849194007317/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const match = data.match(/https:\/\/i\.pinimg\.com\/originals\/[^\s"'><]+?(?:\.gif|\.png|\.jpg)/i);
    if (match) {
      console.log('Image Found:', match[0]);
    } else {
      console.log('No direct image found.');
    }
  });
}).on('error', err => console.error(err));
