#!/usr/bin/env python3
"""Compare web pill colors to iOS ground truth for each card row."""
from PIL import Image

SCALE = 3
ROWS = [
    ("black", 84), ("#2b2b2b", 84), ("#808080", 84), ("white", 84),
    ("red", 84), ("blue", 84), ("split", 84), ("photo", 96), ("photo+Week", 96),
]
SPACER = 62

def box_mean(im, cx, cy, r=14):
    px = im.load()
    xs = range(max(0, cx - r), min(im.width, cx + r))
    ys = range(max(0, cy - r), min(im.height, cy + r))
    n, rs, gs, bs = 0, 0, 0, 0
    for x in xs:
        for y in ys:
            p = px[x, y][:3]
            rs += p[0]; gs += p[1]; bs += p[2]; n += 1
    return (rs / n, gs / n, bs / n)

def hexc(c): return "#%02x%02x%02x" % tuple(round(v) for v in c)
def delta(a, b): return sum(abs(x - y) for x, y in zip(a, b)) / 3

ios = Image.open("/tmp/native_card.png").convert("RGB")
web = Image.open("/tmp/web_card_v2.png").convert("RGB")

print(f"{'row':>10} | {'ios-dark':>8} {'web-dark':>8} {'Δ':>5} | {'ios-light':>9} {'web-light':>9} {'Δ':>5}")
tot_l = tot_d = 0
y = SPACER + 0.0
for name, h in ROWS:
    cy = int((y + h / 2) * SCALE)
    y += h
    lx, rx = int(0.25 * ios.width), int(0.75 * ios.width)
    if name == "photo+Week":
        continue
    for label, cx, side in (("dark", lx, 0), ("light", rx, 1)):
        i = box_mean(ios, cx, cy); w = box_mean(web, cx, cy)
        d = delta(i, w)
        if side:
            print(f"{name:>10} | {'':8} {'':8} {'':5} | {hexc(i):>9} {hexc(w):>9} {d:5.1f}")
            tot_l += d
        else:
            print(f"{name:>10} | {hexc(i):>8} {hexc(w):>8} {d:5.1f} |", end="")
            tot_d += d
print(f"\nmean Δ dark {tot_d/8:.1f}  light {tot_l/8:.1f}")
