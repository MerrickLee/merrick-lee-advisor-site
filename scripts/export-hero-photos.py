#!/usr/bin/env python3
"""Crop and export homepage hero photos (WebP + JPEG, sRGB, no EXIF/GPS).

Source full-res files live outside the repo (HappiLEE Ever After 2026 album).
This script documents the crop boxes so adding 297, or regenerating assets,
is a one-command change.

Usage:
  python3 scripts/export-hero-photos.py /path/to/picks

Expected filenames in that folder:
  312-DSC07597.jpg  287-DSC07570.jpg  292-DSC07575.jpg  297-DSC07580.jpg
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageCms

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "img" / "opt"

PHOTOS = {
    "312-DSC07597.jpg": {
        "stem": "merrick-lee-seated-portrait",
        "box": (1612, 0, 6284, 4672),  # 1:1, subject right-of-center
        "object_position": "62% 36%",
    },
    "287-DSC07570.jpg": {
        "stem": "merrick-lee-speaking-handheld-mic",
        "box": (1765, 620, 4885, 4520),  # 4:5, balloon arch cropped
        "object_position": "50% 30%",
    },
    "292-DSC07575.jpg": {
        "stem": "merrick-lee-speaking-arm-extended",
        "box": (1360, 650, 5260, 4550),  # 1:1, keeps a hint of the extended arm
        "object_position": "46% 30%",
    },
    # Reserved: uncomment the k8 <picture> in index.html to add this slide.
    "297-DSC07580.jpg": {
        "stem": "merrick-lee-speaking-mic-portrait",
        "box": (280, 560, 4391, 5746),  # tight upper-body portrait
        "object_position": "50% 28%",
    },
}


def to_srgb(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    profile = im.info.get("icc_profile")
    if not profile:
        return im
    src = ImageCms.ImageCmsProfile(io.BytesIO(profile))
    dst = ImageCms.createProfile("sRGB")
    return ImageCms.profileToProfile(im, src, dst, outputMode="RGB")


def resize_to_width(im: Image.Image, width: int, max_long: int = 2000) -> Image.Image:
    w, h = im.size
    nh = int(round(h * (width / w)))
    nw = width
    if nh > max_long:
        nh = max_long
        nw = int(round(w * (max_long / h)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def save_pair(im: Image.Image, stem: str, width: int) -> None:
    resized = resize_to_width(im, width)
    # Strip EXIF/XMP/ICC: do not pass metadata through.
    resized.save(
        DEST / f"{stem}-{width}.jpg",
        format="JPEG",
        quality=82,
        optimize=True,
        progressive=True,
        subsampling=2,
    )
    resized.save(
        DEST / f"{stem}-{width}.webp",
        format="WEBP",
        quality=80,
        method=6,
    )


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 scripts/export-hero-photos.py /path/to/picks")
    src_dir = Path(sys.argv[1])
    DEST.mkdir(parents=True, exist_ok=True)
    for name, spec in PHOTOS.items():
        path = src_dir / name
        if not path.exists():
            print(f"skip missing {path}")
            continue
        cropped = to_srgb(Image.open(path)).crop(spec["box"])
        save_pair(cropped, spec["stem"], 800)
        save_pair(cropped, spec["stem"], 1600)
        print(spec["stem"], cropped.size, "object-position:", spec["object_position"])


if __name__ == "__main__":
    main()
