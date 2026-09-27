#!/usr/bin/env python3
"""Generate the missing PWA/social assets for krelz-public/frontend/public.

Pure-stdlib (zlib + struct) so it runs without PIL: writes RGBA PNGs and an
ICO that embeds a PNG (supported by every modern browser).

Run:  python3 scripts/generate_assets.py
"""
import os
import struct
import zlib

FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
}

TOP = (30, 27, 75)      # #1e1b4b (manifest theme_color)
BOTTOM = (56, 189, 248)  # #38bdf8 (accent)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[(0, 0, 0, 0) for _ in range(w)] for _ in range(h)]

    def put(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = color

    def gradient_bg(self, top=TOP, bottom=BOTTOM):
        for y in range(self.h):
            t = y / max(1, self.h - 1)
            c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
            for x in range(self.w):
                self.px[y][x] = (c[0], c[1], c[2], 255)

    def fill_rect(self, x0, y0, x1, y1, color, radius=0):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                if radius:
                    cx = min(x - x0, x1 - 1 - x) + 1
                    cy = min(y - y0, y1 - 1 - y) + 1
                    if cx <= radius and cy <= radius:
                        dx, dy = radius - cx, radius - cy
                        if dx * dx + dy * dy > radius * radius:
                            continue
                self.put(x, y, color)

    def text(self, x, y, s, scale, color, spacing=1):
        """Draw uppercased 5x7 bitmap text, top-left anchored at (x, y)."""
        cursor = x
        for ch in s.upper():
            glyph = FONT.get(ch, FONT[" "])
            for row, bits in enumerate(glyph):
                for col, bit in enumerate(bits):
                    if bit == "1":
                        self.fill_rect(
                            cursor + col * scale, y + row * scale,
                            cursor + (col + 1) * scale, y + (row + 1) * scale,
                            color,
                        )
            cursor += (5 + spacing) * scale
        return cursor - spacing * scale

    def text_width(self, s, scale, spacing=1):
        return len(s) * (5 + spacing) * scale - spacing * scale

    def circle(self, cx, cy, r, color, filled=True, width=3):
        r2 = r * r
        for y in range(cy - r - width, cy + r + width + 1):
            for x in range(cx - r - width, cx + r + width + 1):
                d2 = (x - cx) ** 2 + (y - cy) ** 2
                if filled:
                    if d2 <= r2:
                        self.put(x, y, color)
                elif r2 - 2 * r * width <= d2 <= r2:
                    self.put(x, y, color)

    def line(self, x0, y0, x1, y1, color, width=2):
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            x = int(x0 + (x1 - x0) * i / steps)
            y = int(y0 + (y1 - y0) * i / steps)
            for dx in range(-width, width + 1):
                for dy in range(-width, width + 1):
                    self.put(x + dx, y + dy, color)


def png_bytes(canvas):
    raw = bytearray()
    for row in canvas.px:
        raw.append(0)  # filter: none
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c

    ihdr = struct.pack(">IIBBBBB", canvas.w, canvas.h, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def draw_icon(size, path):
    c = Canvas(size, size)
    c.gradient_bg()
    accent = (255, 255, 255, 255)

    # network motif, tucked into the top-right corner so it never crosses the K
    m = max(6, size // 20)
    nodes = [(size - m, m), (size - 3 * m, int(m * 2.2)), (size - int(m * 2.5), int(m * 3.8))]
    for i in range(len(nodes) - 1):
        c.line(*nodes[i], *nodes[i + 1], (255, 255, 255, 70), width=max(1, size // 160))
    for (x, y) in nodes:
        c.circle(x, y, max(2, size // 40), (255, 255, 255, 150))

    # large K
    scale = max(4, size // 14)
    kw = 5 * scale
    kx = (size - kw) // 2
    ky = (size - 7 * scale) // 2 - size // 16
    for row, bits in enumerate(FONT["K"]):
        for col, bit in enumerate(bits):
            if bit == "1":
                c.fill_rect(kx + col * scale, ky + row * scale,
                            kx + (col + 1) * scale, ky + (row + 1) * scale,
                            (56, 189, 248, 255) if size >= 256 else accent)

    # wordmark
    wscale = max(1, size // 48)
    word = "KRELZ"
    wt = c.text_width(word, wscale)
    c.text((size - wt) // 2, ky + 7 * scale + size // 16, word, wscale, accent)

    with open(path, "wb") as fh:
        fh.write(png_bytes(c))
    return c


def draw_og(path):
    w, h = 1200, 630
    c = Canvas(w, h)
    c.gradient_bg((15, 23, 42), (30, 64, 175))

    # faint grid
    for x in range(0, w, 60):
        c.line(x, 0, x, h, (255, 255, 255, 14), width=0)
    for y in range(0, h, 60):
        c.line(0, y, w, y, (255, 255, 255, 14), width=0)

    white = (255, 255, 255, 255)
    cyan = (56, 189, 248, 255)

    title, scale = "KRELZ", 12
    tw = c.text_width(title, scale)
    c.text((w - tw) // 2, h // 2 - 7 * scale - 40, title, scale, white)

    sub = "DECENTRALIZED LLM INFERENCE NETWORK"
    sscale = 4
    sw = c.text_width(sub, sscale)
    c.text((w - sw) // 2, h // 2 + 7 * scale + 30, sub, sscale, cyan)

    ctext = "SHARE GPU POWER. EARN KRELZ."
    cscale = 3
    cw = c.text_width(ctext, cscale)
    c.text((w - cw) // 2, h // 2 + 7 * scale + 30 + 7 * cscale + 40, ctext, cscale, white)

    with open(path, "wb") as fh:
        fh.write(png_bytes(c))


def draw_favicon(path, size=32):
    c = Canvas(size, size)
    c.gradient_bg()
    scale = 3
    kx, ky = (size - 5 * scale) // 2, (size - 7 * scale) // 2
    for row, bits in enumerate(FONT["K"]):
        for col, bit in enumerate(bits):
            if bit == "1":
                c.fill_rect(kx + col * scale, ky + row * scale,
                            kx + (col + 1) * scale, ky + (row + 1) * scale,
                            (255, 255, 255, 255))

    data = png_bytes(c)
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(data), 22)
    with open(path, "wb") as fh:
        fh.write(header + entry + data)


def main():
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "frontend", "public")
    os.makedirs(out, exist_ok=True)

    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"),
                       (180, "apple-touch-icon.png")):
        draw_icon(size, os.path.join(out, name))
        print("wrote", name)

    draw_og(os.path.join(out, "og-image.png"))
    print("wrote og-image.png")

    draw_favicon(os.path.join(out, "favicon.ico"))
    print("wrote favicon.ico")

    # SVG favicon keeps a crisp icon at any DPR (referenced from _document).
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#1e1b4b"/>'
        '<stop offset="1" stop-color="#38bdf8"/></linearGradient></defs>'
        '<rect width="64" height="64" rx="12" fill="url(#g)"/>'
        '<path fill="#fff" d="M18 14h8v13l9-13h10L34 30l12 20H35l-9-15v15h-8z"/>'
        "</svg>"
    )
    with open(os.path.join(out, "favicon.svg"), "w") as fh:
        fh.write(svg)
    print("wrote favicon.svg")


if __name__ == "__main__":
    main()
