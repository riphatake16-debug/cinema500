#!/usr/bin/env python3
"""Build light card thumbnails and re-encode oversized hero backdrops."""
import sys
from pathlib import Path

from PIL import Image


def build_thumbs(source, target, width, quality):
    count = 0
    before = 0
    after = 0
    for path in sorted(source.glob('tt*.jpg')):
        out = target / path.with_suffix('.webp').name
        if out.exists() and out.stat().st_mtime >= path.stat().st_mtime:
            continue
        with Image.open(path) as image:
            image = image.convert('RGB')
            if image.width > width:
                height = round(image.height * width / image.width)
                image = image.resize((width, height), Image.LANCZOS)
            image.save(out, 'WEBP', quality=quality, method=4)
        before += path.stat().st_size
        after += out.stat().st_size
        count += 1
    print(f'thumbnails: {count} built, {before / 1e6:.1f}MB -> {after / 1e6:.1f}MB')


def shrink_backdrops(directory, max_width=1280, quality=75):
    if not directory.is_dir():
        return
    saved = 0
    for path in sorted(directory.glob('*.jpg')):
        before = path.stat().st_size
        with Image.open(path) as image:
            image = image.convert('RGB')
            width = min(image.width, max_width)
            if width != image.width:
                image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
            temp = path.with_suffix('.tmp.jpg')
            image.save(temp, 'JPEG', quality=quality, optimize=True, progressive=True)
        after = temp.stat().st_size
        if after < before:
            temp.replace(path)
            saved += before - after
        else:
            temp.unlink()
    print(f'backdrops: {saved / 1e6:.1f}MB saved')


def main():
    source = Path(sys.argv[1] if len(sys.argv) > 1 else 'posters')
    target = Path(sys.argv[2] if len(sys.argv) > 2 else 'posters/thumbs')
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 300
    quality = int(sys.argv[4]) if len(sys.argv) > 4 else 72
    target.mkdir(parents=True, exist_ok=True)
    build_thumbs(source, target, width, quality)
    shrink_backdrops(source.parent / 'backdrops')


if __name__ == '__main__':
    main()
