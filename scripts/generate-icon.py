#!/usr/bin/env python3
"""
Generate macOS .icns from source PNG with proper squircle mask and all 10 sizes.
macOS icon corner radius ≈ 22.37% of icon size.
macOS standard icon artwork fills ~82% of canvas (9% padding each side).
"""
import os
from PIL import Image, ImageDraw, ImageFilter

SRC = "/Users/qiguo/Documents/MTeX/resources/icons/扁平风.png"
OUT = "/Users/qiguo/Documents/MTeX/resources/icon.iconset"
ICNS = "/Users/qiguo/Documents/MTeX/resources/icon.icns"

# Standard macOS icon sizes (points): 16, 32, 128, 256, 512
# Each at 1x and 2x (@2x = double pixels)
SIZES = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

# macOS icons typically have artwork at ~82% of canvas
ARTWORK_RATIO = 0.82

def squircle_corner_radius(size: int) -> float:
    """macOS-style corner radius: ~22.37% of icon width."""
    return size * 0.2237

def create_squircle_mask(size: int) -> Image.Image:
    """Create a rounded-rect mask matching macOS icon curvature."""
    r = int(squircle_corner_radius(size))
    if r < 2:
        r = 2

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)

    draw.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=r,
        fill=255,
    )

    if size >= 64:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=size * 0.002))
        mask = mask.point(lambda x: 255 if x > 128 else 0)

    return mask

def apply_mask(img: Image.Image, mask: Image.Image) -> Image.Image:
    """Composite an RGBA image onto transparent background using the given alpha mask."""
    r, g, b, a = img.split()
    final_alpha = Image.composite(a, Image.new("L", img.size, 0), mask)
    return Image.merge("RGBA", (r, g, b, final_alpha))

def generate_icon(src_img: Image.Image, size: int) -> Image.Image:
    """Generate a single icon at given pixel size with squircle mask
    and proper macOS padding (artwork ~82% of canvas)."""
    artwork_px = int(size * ARTWORK_RATIO)

    # Step 1: scale source to artwork size & squircle-mask it
    # This removes the source image's own white corners
    artwork = src_img.resize((artwork_px, artwork_px), Image.LANCZOS)
    if artwork.mode != "RGBA":
        artwork = artwork.convert("RGBA")
    artwork_mask = create_squircle_mask(artwork_px)
    artwork = apply_mask(artwork, artwork_mask)

    # Step 2: place masked artwork on transparent canvas
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (size - artwork_px) // 2
    canvas.paste(artwork, (offset, offset))

    # Step 3: apply outer squircle mask for the final icon shape
    outer_mask = create_squircle_mask(size)
    result = apply_mask(canvas, outer_mask)

    return result

def main():
    print(f"Loading source: {SRC}")
    src = Image.open(SRC)
    print(f"  Size: {src.size}, Mode: {src.mode}")

    # Convert to RGB if palette/indexed
    if src.mode in ("P", "I"):
        src = src.convert("RGB")
    elif src.mode == "RGBA":
        # Flatten on white before masking
        bg = Image.new("RGB", src.size, (255, 255, 255))
        bg.paste(src, mask=src.split()[3])
        src = bg
    else:
        src = src.convert("RGB")

    os.makedirs(OUT, exist_ok=True)

    print("Generating icon sizes:")
    for name, px in SIZES:
        icon = generate_icon(src, px)
        path = os.path.join(OUT, name)
        icon.save(path, "PNG")
        print(f"  {name} ({px}×{px}) ✓")

    # Convert iconset to .icns
    print(f"\nConverting to .icns...")
    import subprocess
    subprocess.run(["iconutil", "-c", "icns", "-o", ICNS, OUT], check=True)
    print(f"  {ICNS} ✓")

    # Verify
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", ICNS],
        capture_output=True, text=True
    )
    print(f"\nVerification: {result.stdout.strip()}")

if __name__ == "__main__":
    main()
