#!/usr/bin/env python3
import os
import math
import subprocess
from PIL import Image

N_PATH = (
    "M0 1.792H14.592V11.648H14.848C16.2133 8.576 18.56 5.888 21.888 3.584"
    "C25.3013 1.19467 29.312 0 33.92 0C37.9307 0 41.344 0.725333 44.16 2.176"
    "C47.0613 3.54133 49.408 5.376 51.2 7.68C53.0773 9.984 54.4427 12.6293 55.296 15.616"
    "C56.1493 18.6027 56.576 21.6747 56.576 24.832V63.232H41.216V29.184"
    "C41.216 27.392 41.088 25.5147 40.832 23.552C40.576 21.5893 40.0213 19.84 39.168 18.304"
    "C38.3147 16.6827 37.12 15.36 35.584 14.336C34.1333 13.312 32.1707 12.8 29.696 12.8"
    "C27.2213 12.8 25.088 13.312 23.296 14.336C21.504 15.2747 20.0107 16.512 18.816 18.048"
    "C17.7067 19.584 16.8533 21.376 16.256 23.424C15.6587 25.3867 15.36 27.392 15.36 29.44"
    "V63.232H0V1.792Z"
)

BLUE_SLATE  = "#4F6D7A"
BURNT_PEACH = "#DD6E42"
ASH_GREY    = "#B8C7B7"
THISTLE     = "#D2BFDE"
CLAY_SOIL   = "#805448"
CHARCOAL    = "#575353"
DARK_BASE   = "#111827"
WHITE       = "#FFFFFF"

PALETTE = [BLUE_SLATE, BURNT_PEACH, ASH_GREY, THISTLE, CLAY_SOIL, CHARCOAL]

# Option B parameters: r=445, stroke=46, scale=8.0, gap=28
r = 445
stroke_width = 46
n_scale = 8.0
gap = 28

C = 2 * math.pi * r
slot = C / 6.0
seg = slot - gap
dasharray = f"{seg:.1f} {(C - seg):.1f}"

circles = []
for i, col in enumerate(PALETTE):
    offset = f"{(-slot * i):.1f}"
    circles.append(
        f'    <circle cx="500" cy="500" r="{r}" stroke="{col}" stroke-dasharray="{dasharray}" stroke-dashoffset="{offset}" />'
    )

circles_svg = "\n".join(circles)

tx = 500 - (56.576 * n_scale) / 2
ty = 500 - (63.232 * n_scale) / 2

master_svg = f"""<svg width="1000" height="1000" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="1000" fill="{WHITE}"/>
  <g transform="rotate(-90 500 500)" stroke-width="{stroke_width}" fill="none" stroke-linecap="butt">
{circles_svg}
  </g>
  <g transform="translate({tx:.1f}, {ty:.1f}) scale({n_scale})">
    <path d="{N_PATH}" fill="{DARK_BASE}"/>
  </g>
</svg>"""

os.makedirs("assets/branding", exist_ok=True)
os.makedirs("apps/web/public", exist_ok=True)

# Save master vector
svg_master_path = "assets/branding/app-icon-palette-ring.svg"
with open(svg_master_path, "w") as f:
    f.write(master_svg)

with open("apps/web/public/favicon.svg", "w") as f:
    f.write(master_svg)

# Render standard icons
PUBLIC_DIR = "apps/web/public"
subprocess.run(["rsvg-convert", "-w", "512", "-h", "512", svg_master_path, "-o", f"{PUBLIC_DIR}/icon-512.png"], check=True)
subprocess.run(["rsvg-convert", "-w", "192", "-h", "192", svg_master_path, "-o", f"{PUBLIC_DIR}/icon-192.png"], check=True)
subprocess.run(["rsvg-convert", "-w", "180", "-h", "180", svg_master_path, "-o", f"{PUBLIC_DIR}/apple-touch-icon.png"], check=True)

# Maskable icons:
# For Android adaptive icons, the safe zone is an inner circle/squircle of diameter ~66% to 80%.
# The outer diameter of our ring is 2 * (445 + 23) = 936px on 1000px canvas (93.6%).
# To ensure the outer ring is never clipped by Android adaptive circles, we scale down to ~80%
# centered on a white canvas.
base_512 = Image.open(f"{PUBLIC_DIR}/icon-512.png").convert("RGBA")

# 512 maskable (inner scale 410px out of 512px)
maskable_512 = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
scaled_512 = base_512.resize((410, 410), Image.Resampling.LANCZOS)
offset_512 = (512 - 410) // 2
maskable_512.paste(scaled_512, (offset_512, offset_512), scaled_512)
maskable_512.save(f"{PUBLIC_DIR}/icon-maskable-512.png")

# 192 maskable (inner scale 154px out of 192px)
maskable_192 = Image.new("RGBA", (192, 192), (255, 255, 255, 255))
scaled_192 = base_512.resize((154, 154), Image.Resampling.LANCZOS)
offset_192 = (192 - 154) // 2
maskable_192.paste(scaled_192, (offset_192, offset_192), scaled_192)
maskable_192.save(f"{PUBLIC_DIR}/icon-maskable-192.png")

print("Generated canonical 94% fill icon assets successfully!")
