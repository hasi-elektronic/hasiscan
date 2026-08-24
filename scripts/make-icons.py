#!/usr/bin/env python3
"""Rasterize HasiScan app icons from the brand mark."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("/workspace/public/icons")
CHARCOAL = (11, 15, 18, 255)
PAPER = (243, 239, 230, 255)
CYAN = (58, 186, 223, 255)


def draw_mark(size: int, *, padded: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    inset = int(size * 0.18) if padded else 0
    box = size - inset * 2
    x0, y0 = inset, inset
    radius = int(box * 0.22)
    draw.rounded_rectangle(
        [x0, y0, x0 + box - 1, y0 + box - 1],
        radius=radius,
        fill=CHARCOAL,
    )
    # paper
    px = x0 + int(box * 0.34)
    py = y0 + int(box * 0.26)
    pw = int(box * 0.32)
    ph = int(box * 0.48)
    pr = max(2, int(box * 0.04))
    draw.rounded_rectangle([px, py, px + pw, py + ph], radius=pr, fill=PAPER)
    # viewfinder corners
    t = max(3, int(box * 0.055))
    arm = int(box * 0.16)
    gap = int(box * 0.12)
    left = x0 + gap
    top = y0 + gap
    right = x0 + box - gap
    bottom = y0 + box - gap
    # tl
    draw.rectangle([left, top, left + arm, top + t], fill=CYAN)
    draw.rectangle([left, top, left + t, top + arm], fill=CYAN)
    # tr
    draw.rectangle([right - arm, top, right, top + t], fill=CYAN)
    draw.rectangle([right - t, top, right, top + arm], fill=CYAN)
    # bl
    draw.rectangle([left, bottom - t, left + arm, bottom], fill=CYAN)
    draw.rectangle([left, bottom - arm, left + t, bottom], fill=CYAN)
    # br
    draw.rectangle([right - arm, bottom - t, right, bottom], fill=CYAN)
    draw.rectangle([right - t, bottom - arm, right, bottom], fill=CYAN)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    specs = [
        ("icon-180.png", 180, False),
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-512-maskable.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, padded in specs:
        draw_mark(size, padded=padded).save(OUT / name, "PNG")
        print("wrote", OUT / name)


if __name__ == "__main__":
    main()
