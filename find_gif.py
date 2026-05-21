import urllib.request
import re
import json

url = "https://giphy.com/search/pixel-dinosaur-sticker"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    # Giphy stores initial state in a script tag with window.__GIPHY_STATE__
    match = re.search(r'window\.__GIPHY_STATE__\s*=\s*({.*?});', html)
    if match:
        data = json.loads(match.group(1))
        # Need to parse their state to find gifs, it might be nested
        print("Found state")
        # Just use regex to find media.giphy.com/media/.../giphy.gif
        gifs = re.findall(r'https://media[a-zA-Z0-9-]*\.giphy\.com/media/[a-zA-Z0-9]+/giphy\.gif', html)
        gifs = list(set(gifs))
        print("Found gifs:", gifs[:5])
    else:
        gifs = re.findall(r'https://media[a-zA-Z0-9-]*\.giphy\.com/media/[a-zA-Z0-9]+/giphy\.gif', html)
        gifs = list(set(gifs))
        print("Regex fallback found gifs:", gifs[:5])
except Exception as e:
    print(e)
