#!/usr/bin/env python3
"""release/store/raw -> release/store/{google,rustore,yandex}/ (24-bit RGB PNG, no alpha; sizes checked against store limits).
Run after: node test/shots_store.js ; node tools/render.js (icon/cover art) ; node test/trailer_rec.js && python3 tools/make_trailer.py"""
import os, glob, shutil
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); S = os.path.join(ROOT, 'release/store'); RAW = S + '/raw'
def put(src, dst, size, maxmb):
    im = Image.open(os.path.join(RAW, src)); assert im.size == size, (src, im.size)
    os.makedirs(os.path.dirname(dst), exist_ok=True); im.convert('RGB').save(dst, optimize=True)
    mb = os.path.getsize(dst) / 2**20; assert mb <= maxmb, (dst, mb); print(f'{os.path.relpath(dst, S):60s} {size[0]}x{size[1]} {mb:.2f} MB')
for d in ('google', 'rustore', 'yandex'):
    for f in glob.glob(f'{S}/{d}/*.png'): os.remove(f)
put('icon_512.png', S + '/google/icon_512.png', (512, 512), 1)
put('fg_1024x500.png', S + '/google/feature_graphic_1024x500.png', (1024, 500), 15)
put('icon_512.png', S + '/rustore/icon_512.png', (512, 512), 3)
put('icon_512.png', S + '/yandex/icon_512x512.png', (512, 512), 3)
put('cover_800x470.png', S + '/yandex/cover_800x470.png', (800, 470), 3)
put('showcase_1560x520.png', S + '/yandex/cover_showcase_1560x520.png', (1560, 520), 3)
for f in sorted(glob.glob(RAW + '/mobile_*.png')):
    n = os.path.basename(f)[7:]      # "1_game.png"
    put(os.path.basename(f), f'{S}/google/phone_{n}', (1080, 1920), 8)
    put(os.path.basename(f), f'{S}/rustore/phone_{n}', (1080, 1920), 3)
    put(os.path.basename(f), f'{S}/yandex/screenshot_mobile_{n}', (1080, 1920), 3)
for f in sorted(glob.glob(RAW + '/desktop_*.png')):
    n = os.path.basename(f)[8:]
    put(os.path.basename(f), f'{S}/google/tablet_{n}', (1920, 1080), 8)
    put(os.path.basename(f), f'{S}/rustore/tablet_{n}', (1920, 1080), 5)
    put(os.path.basename(f), f'{S}/yandex/screenshot_desktop_{n}', (1920, 1080), 3)
