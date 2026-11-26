"""Crop the four QA screenshots used by the report and slide deck.

The source screenshots are produced by the Playwright QA run. Keeping the
cropped copies in docs/presentation/screenshots makes the report reproducible
without depending on a temporary folder.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

QA = Path(r"C:\Users\works\AppData\Local\Temp\opencode\bidnet-qa")
SHOTS = Path(__file__).parent / "screenshots"
IMAGES = Path(__file__).parent / "images"

SOURCES = {
    "frontend-home.png": QA / "polish" / "home.png",
    "frontend-auctions.png": QA / "final" / "auctions-active.png",
    "frontend-detail.png": QA / "final" / "detail-active.png",
    "frontend-admin.png": QA / "polish" / "admin-products.png",
}

for name, source in SOURCES.items():
    im = Image.open(source).convert("RGB")
    im.crop((0, 0, min(im.width, 1440), min(im.height, 900))).save(SHOTS / name)

canvas = Image.new("RGB", (1600, 1000), "white")
draw = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 24)
except OSError:
    font = ImageFont.load_default()

panels = [
    ("Trang chủ", "frontend-home.png", 30, 55),
    ("Tìm kiếm và lọc phiên", "frontend-auctions.png", 810, 55),
    ("Chi tiết phiên và đặt giá", "frontend-detail.png", 30, 555),
    ("Quản trị phiên đấu giá", "frontend-admin.png", 810, 555),
]
for label, name, x, y in panels:
    draw.text((x, y - 31), label, fill=(20, 40, 82), font=font)
    im = Image.open(SHOTS / name).convert("RGB")
    im = im.resize((760, 430), Image.LANCZOS)
    canvas.paste(im, (x, y))
    draw.rectangle((x, y, x + 759, y + 429), outline=(195, 208, 229), width=2)

canvas.save(IMAGES / "frontend-pages.png")
print("Created", SHOTS / "frontend-*.png")
print("Created", IMAGES / "frontend-pages.png")
