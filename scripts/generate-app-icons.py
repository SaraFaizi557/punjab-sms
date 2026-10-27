"""Generate transparent Punjab-SMS app icons from the Digital Education Emblem."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SRC = Path(
    r"C:\Users\MOHID\.cursor\projects\d-FAIZI-PROJECTS-JavaScript-punjab-sms"
    r"\assets\c__Users_MOHID_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"dcb0f4a2b02f51db34f5e9ebb748cee3_images_Digital_Education_Emblem-"
    r"94d6e8e8-15ff-4168-ad55-8e6a2b0559ec.png"
)
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public"
MASTER = OUT_DIR / "app-brand-logo.png"
NAVY = (11, 58, 110, 255)  # #0B3A6E


def remove_backdrop(im: Image.Image) -> Image.Image:
    w, h = im.size
    px = im.load()

    content = Image.new("L", (w, h), 0)
    cp = content.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            mx = max(r, g, b)
            mn = min(r, g, b)
            chroma = mx - mn
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if chroma >= 28:
                cp[x, y] = 255
            elif chroma >= 12 and lum < 110 and a > 80:
                cp[x, y] = 255
            elif chroma >= 8 and lum < 55 and a > 120:
                cp[x, y] = 220

    content_soft = content.filter(ImageFilter.MaxFilter(9))
    content_soft = content_soft.filter(ImageFilter.GaussianBlur(radius=2.2))
    cs = content_soft.load()

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 4:
                continue
            mx = max(r, g, b)
            mn = min(r, g, b)
            chroma = mx - mn
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            support = cs[x, y] / 255.0

            if support < 0.08:
                continue
            if chroma < 10 and lum < 18:
                continue

            new_a = a
            if chroma < 24:
                mist_kill = max(0.0, 1.0 - (chroma / 24.0))
                if lum > 90:
                    keep = support * (1.0 - 0.92 * mist_kill) * (chroma / 24.0 + 0.05)
                elif lum > 40:
                    keep = support * (1.0 - 0.75 * mist_kill)
                else:
                    keep = support * (1.0 - 0.35 * mist_kill)
                new_a = int(a * max(0.0, min(1.0, keep)))
            elif support < 0.45:
                new_a = int(a * (0.55 + 0.45 * support))

            if new_a < 6:
                continue
            op[x, y] = (r, g, b, new_a)
    return out


def to_square(img: Image.Image, pad: int = 36, margin_ratio: float = 0.04) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        raise RuntimeError("empty after background removal")
    w, h = img.size
    l, t, rgt, bot = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    rgt = min(w, rgt + pad)
    bot = min(h, bot + pad)
    cropped = img.crop((l, t, rgt, bot))
    cw, ch = cropped.size
    side = max(cw, ch)
    margin = int(side * margin_ratio)
    side = side + margin * 2
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
    return square.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))


def fit(img: Image.Image, size: int, pad_ratio: float = 0.08) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = max(1, int(size * (1 - 2 * pad_ratio)))
    thumb = img.copy()
    thumb.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    tw, th = thumb.size
    canvas.paste(thumb, ((size - tw) // 2, (size - th) // 2), thumb)
    return canvas


def fit_maskable(
    img: Image.Image,
    size: int,
    bg=NAVY,
    pad_ratio: float = 0.18,
) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg)
    inner = max(1, int(size * (1 - 2 * pad_ratio)))
    thumb = img.copy()
    thumb.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    tw, th = thumb.size
    canvas.paste(thumb, ((size - tw) // 2, (size - th) // 2), thumb)
    return canvas


def write_favicon_svg(master: Image.Image, dest: Path) -> None:
    """Embed a compact PNG data-URL SVG so browsers get the color mark crisply."""
    import base64
    import io

    tiny = fit(master, 128, 0.06)
    buf = io.BytesIO()
    tiny.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        'viewBox="0 0 128 128" width="128" height="128">\n'
        f'  <image width="128" height="128" href="data:image/png;base64,{b64}"/>\n'
        "</svg>\n"
    )
    dest.write_text(svg, encoding="utf-8")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"source missing: {SRC}")

    raw = Image.open(SRC).convert("RGBA")
    cleaned = remove_backdrop(raw)
    square = to_square(cleaned)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # In-app / website brand mark — transparent
    transparent_exports = {
        "favicon.png": (48, 0.06),
        "app-brand.png": (1024, 0.06),
        "app-brand-logo.png": (1024, 0.05),
    }
    for name, (sz, pad) in transparent_exports.items():
        fit(square, sz, pad).save(OUT_DIR / name, "PNG", optimize=True)
        print(f"wrote {name} ({sz}x{sz}, transparent)")

    # Installed PWA / Android / desktop icons — navy plate (opaque, launcher-safe)
    pwa_exports = {
        "pwa-icon-192.png": (192, 0.12),
        "pwa-icon-512.png": (512, 0.12),
        "pwa-ico.png": (512, 0.12),
        "pwa-icon-512-maskable.png": (512, 0.18),
        "apple-touch-icon.png": (180, 0.12),
    }
    for name, (sz, pad) in pwa_exports.items():
        fit_maskable(square, sz, bg=NAVY, pad_ratio=pad).save(
            OUT_DIR / name, "PNG", optimize=True
        )
        print(f"wrote {name} ({sz}x{sz}, navy plate)")

    write_favicon_svg(square, OUT_DIR / "favicon.svg")
    print("wrote favicon.svg")


if __name__ == "__main__":
    main()
