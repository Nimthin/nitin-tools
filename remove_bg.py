import os
from PIL import Image

def remove_background(img_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        datas = img.getdata()
        
        # Get the color of the top-left pixel (assumed to be background)
        bg_color = datas[0]
        
        # We want to remove pixels that are very close to the bg_color
        newData = []
        for item in datas:
            # Check if pixel is close to bg_color (handling slight anti-aliasing if any)
            if abs(item[0] - bg_color[0]) < 15 and abs(item[1] - bg_color[1]) < 15 and abs(item[2] - bg_color[2]) < 15:
                newData.append((255, 255, 255, 0)) # Transparent
            else:
                newData.append(item)
                
        img.putdata(newData)
        img.save(img_path, "PNG")
        print(f"Processed {img_path}")
    except Exception as e:
        print(f"Failed to process {img_path}: {e}")

images = [
    "public/dino/dino-hero.png",
    "public/dino/dino-globe.png",
    "public/dino/dino-thinking.png",
    "public/dino/dino-headphones.png",
    "public/dino/dino-tools.png"
]

for img in images:
    if os.path.exists(img):
        remove_background(img)
    else:
        print(f"Not found: {img}")
