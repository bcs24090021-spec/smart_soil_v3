"""Rasterize a Chinese preview and convert it into a flash-resident RGB565 asset."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'firmware' / 'SmartSoilCropPreview'
OUT.mkdir(parents=True, exist_ok=True)
screen = Image.new('RGB', (320, 240), 'black')
draw = ImageDraw.Draw(screen)
font_path = '/System/Library/Fonts/Hiragino Sans GB.ttc'
def text(x, y, value, size=13, color='#ffffff'):
    draw.text((x, y), value, font=ImageFont.truetype(font_path, size), fill=color)

text(10, 6, 'SMART SOIL', 15, '#70edb5')
text(191, 8, '候选示例  1/3', 13, '#f4ca70')
draw.line((10, 30, 310, 30), fill='#526267')
source = ROOT / 'output' / 'tft-concept' / 'web_plant_render.png'
asset = Image.open(source).convert('RGB')
asset.thumbnail((140, 159), Image.Resampling.LANCZOS)
screen.paste(asset, (8, 40))
text(10, 194, 'Web 通用模型示意', 10, '#a9b7bd')
draw.line((154, 40, 154, 206), fill='#526267')
text(164, 38, '番茄', 23)
text(164, 70, 'Tomato', 12, '#a9b7bd')
text(164, 93, 'pH 6.2（示例）', 14, '#70edb5')
text(164, 119, 'AI 解读 · 示例', 13, '#70edb5')
text(164, 145, '仅按酸碱度初筛', 12)
text(164, 164, '养分、盐分未检测', 12)
text(164, 183, '不保证种植成功', 12)
draw.line((10, 212, 310, 212), fill='#526267')
text(10, 219, '仅为初筛', 11, '#f4ca70')
text(180, 219, '未连接 AI / 云端', 11, '#a9b7bd')
screen.save(OUT / 'screen_preview_320x240.png')
screen.resize((960, 720), Image.Resampling.NEAREST).save(OUT / 'screen_preview_large.png')
pixels = [(r >> 3) << 11 | (g >> 2) << 5 | (b >> 3) for r, g, b in screen.getdata()]
lines = [', '.join(f'0x{p:04x}' for p in pixels[i:i+16]) for i in range(0,len(pixels),16)]
(OUT / 'ScreenAsset.h').write_text('#pragma once\n#include <Arduino.h>\nconst uint16_t SCREEN_ASSET[] PROGMEM = {\n' + ',\n'.join(lines) + '\n};\n', encoding='ascii')
print(OUT)
