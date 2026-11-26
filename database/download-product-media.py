"""Download individually researched model photos; never substitute unrelated images."""
import concurrent.futures
import io
import json
from pathlib import Path
import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "frontend/public/images/products"
OUT.mkdir(parents=True, exist_ok=True)

def download(entry):
    destination = OUT / entry["file"]
    if destination.exists():
        return f"Exists: {entry['model']}"
    response = requests.get(entry["image"], timeout=45)
    response.raise_for_status()
    image = Image.open(io.BytesIO(response.content))
    image = ImageOps.exif_transpose(image).convert("RGBA")
    image.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", image.size, "white")
    canvas.alpha_composite(image)
    canvas.convert("RGB").save(destination, "WEBP", quality=90)
    return f"Downloaded: {entry['model']} ({image.width}x{image.height})"

if __name__ == "__main__":
    entries = json.loads((ROOT / "product-media.json").read_text(encoding="utf-8"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(download, entries):
            print(result)
