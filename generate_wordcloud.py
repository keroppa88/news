import sys
from datetime import datetime
from wordcloud import WordCloud
from PIL import Image, ImageDraw, ImageFont
import os

# Read summary3.txt (tab-separated: keyword\tscore)
word_freq = {}
try:
    with open("summary3.txt", "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) == 2:
                keyword = parts[0].strip()
                try:
                    score = int(parts[1].strip())
                    if keyword and score > 0:
                        word_freq[keyword] = score
                except ValueError:
                    continue
except FileNotFoundError:
    print("summary3.txt not found. Run summarize3.js first.")
    sys.exit(1)

if not word_freq:
    print("No words found in summary3.txt!")
    sys.exit(1)

# Show top keywords
sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
print(f"Total keywords: {len(sorted_words)}")
print(f"Top 30 words: {sorted_words[:30]}")

# Generate word cloud
font_path = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"
wc = WordCloud(
    font_path=font_path,
    width=1200,
    height=600,
    background_color="white",
    max_words=150,
    max_font_size=50,
    min_font_size=6,
    colormap="tab20",
    prefer_horizontal=1,
)

wc.generate_from_frequencies(word_freq)

# Save as JPEG at top level
top_level_path = "wordcloud.jpg"
img = wc.to_image()
draw = ImageDraw.Draw(img)
date_text = datetime.now().strftime("%Y/%m/%d")
try:
    date_font = ImageFont.truetype(font_path, 16)
except (OSError, IOError):
    date_font = ImageFont.load_default()
bbox = draw.textbbox((0, 0), date_text, font=date_font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]
margin = 8
x = img.width - text_w - margin
y = img.height - text_h - margin
draw.text((x, y), date_text, fill="gray", font=date_font)
img.save(top_level_path, "JPEG")
print(f"Word cloud saved to {top_level_path}")

# Save as JPEG in warehouse folder with date-based filename
os.makedirs("warehouse", exist_ok=True)
date_filename = datetime.now().strftime("%Y%m%d") + ".jpg"
warehouse_path = os.path.join("warehouse", date_filename)
img.save(warehouse_path, "JPEG")
print(f"Word cloud saved to {warehouse_path}")
