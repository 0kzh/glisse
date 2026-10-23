#!/usr/bin/env python3
"""Sample pill/row colors from native & web parity screenshots and report deltas.

Screenshots are iPhone 17 sim captures (1206x2622 px = 402x874 pt @3x).
Card layout (pt): 62pt spacer, then rows of 84pt x7, photo rows 96pt x2.
"""
import sys
from PIL import Image

SCALE = 3
ROWS = [
    ("black", 84), ("#2b2b2b", 84), ("#808080", 84), ("white", 84),
    ("red", 84), ("blue", 84), ("split", 84), ("photo", 96), ("photo+Week", 96),
]
SPACER = 62


def box_mean(im, cx, cy, r=12):
    px = im.load()
    xs = range(max(0, cx - r), min(im.width, cx + r))
    ys = range(max(0, cy - r), min(im.height, cy + r))
    n, rs, gs, bs = 0, 0, 0, 0
    for x in xs:
        for y in ys:
            p = px[x, y][:3]
            rs += p[0]; gs += p[1]; bs += p[2]; n += 1
    return (rs / n, gs / n, bs / n)


def fmt(c):
    return f"#{int(c[0]):02x}{int(c[1]):02x}{int(c[2]):02x}"


def delta(a, b):
    return sum(abs(a[i] - b[i]) for i in range(3)) / 3


def samples(path):
    im = Image.open(path).convert("RGB")
    W = im.width
    y = SPACER * SCALE
    out = []
    for name, h in ROWS:
        cy = int(y + h * SCALE / 2)
        lx, rx = int(W * 0.25), int(W * 0.75)
        out.append({
            "name": name,
            "bg_l": box_mean(im, int(W * 0.06), cy),
            "bg_r": box_mean(im, int(W * 0.94), cy),
            "dark": box_mean(im, lx, cy),
            "light": box_mean(im, rx, cy),
        })
        y += h * SCALE
    return im, out


def main():
    nim, ns = samples(sys.argv[1])
    wim, ws = samples(sys.argv[2])
    print(f"{'backdrop':<11}{'bg':<9}{'ios-dark':<9}{'web-dark':<9}{'Δdark':<7}{'ios-light':<10}{'web-light':<10}{'Δlight':<7}")
    for n, w in zip(ns, ws):
        bg = fmt(tuple((n['bg_l'][i] + n['bg_r'][i]) / 2 for i in range(3)))
        print(f"{n['name']:<11}{bg:<9}{fmt(n['dark']):<9}{fmt(w['dark']):<9}{delta(n['dark'], w['dark']):<7.1f}{fmt(n['light']):<10}{fmt(w['light']):<10}{delta(n['light'], w['light']):<7.1f}")


if __name__ == "__main__":
    main()
