#!/usr/bin/env python3
"""
Genera todos los íconos PNG para la PWA de VozSegura.
Uso: python3 generate_icons.py
Requiere: pip install Pillow --break-system-packages
"""

import os
from PIL import Image, ImageDraw, ImageFont

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
OUTPUT_DIR = "icons"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def draw_icon(size):
    """Dibuja el ícono de VozSegura: escudo rojo sobre fondo oscuro."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── Fondo circular oscuro ──────────────────────────
    bg_color = (7, 8, 16, 255)
    draw.ellipse([0, 0, size-1, size-1], fill=bg_color)

    # ── Círculo de acento (borde rojo) ─────────────────
    border = max(2, size // 32)
    accent = (240, 64, 64, 200)
    draw.ellipse([border, border, size-border-1, size-border-1],
                 outline=accent, width=border)

    # ── Escudo simplificado (polígono) ─────────────────
    cx, cy = size // 2, size // 2
    s = size * 0.32   # radio del escudo

    # Forma de escudo: 5 puntos
    shield = [
        (cx,          cy - s),           # top center
        (cx + s,      cy - s * 0.4),     # top right
        (cx + s,      cy + s * 0.3),     # mid right
        (cx,          cy + s),           # bottom point
        (cx - s,      cy + s * 0.3),     # mid left
        (cx - s,      cy - s * 0.4),     # top left
    ]
    shield_pts = [(int(x), int(y)) for x, y in shield]
    draw.polygon(shield_pts, fill=(240, 64, 64, 255))

    # ── Letra "V" blanca centrada ──────────────────────
    font_size = max(8, size // 4)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()

    text = "VS"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw//2, cy - th//2 - size*0.02), text,
              fill=(255, 255, 255, 255), font=font)

    return img

def main():
    print("Generando íconos PWA para VozSegura...")
    for size in SIZES:
        icon = draw_icon(size)
        path = os.path.join(OUTPUT_DIR, f"icon-{size}.png")
        icon.save(path, "PNG", optimize=True)
        print(f"  ✓ icon-{size}.png ({size}x{size})")

    # Screenshot placeholder (390x844)
    ss = Image.new("RGB", (390, 844), (7, 8, 16))
    d = ImageDraw.Draw(ss)
    d.rectangle([0, 0, 390, 120], fill=(13, 15, 26))
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        d.text((20, 44), "VozSegura", fill=(240, 64, 64, 255), font=f)
    except:
        pass
    ss.save(os.path.join(OUTPUT_DIR, "screenshot-mobile.png"), "PNG")
    print("  ✓ screenshot-mobile.png (390x844)")
    print(f"\nTodos los íconos generados en ./{OUTPUT_DIR}/")

if __name__ == "__main__":
    main()
