"""Generate Pokémon Machine app icons without external image dependencies."""

from pathlib import Path
import binascii
import math
import struct
import zlib


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "icons"
OUTPUT.mkdir(parents=True, exist_ok=True)

CREAM = (248, 246, 237)
AQUA = (223, 241, 235)
NAVY = (36, 51, 70)
CORAL = (239, 68, 75)
WHITE = (255, 252, 243)
SHADOW = (196, 198, 187)


def mix(first, second, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(first, second))


def color_at(x, y):
    glow_distance = math.hypot(x - 0.5, y - 0.47)
    glow = max(0.0, 1.0 - glow_distance / 0.68) * 0.5
    color = mix(CREAM, AQUA, glow)

    shadow_distance = math.hypot(x - 0.5, y - 0.535)
    if shadow_distance <= 0.325:
        color = mix(color, SHADOW, 0.34)

    distance = math.hypot(x - 0.5, y - 0.5)
    if distance <= 0.315:
        color = NAVY
    if distance <= 0.267:
        color = CORAL if y < 0.5 else WHITE
        if abs(y - 0.5) <= 0.033:
            color = NAVY

    center_distance = math.hypot(x - 0.5, y - 0.5)
    if center_distance <= 0.096:
        color = NAVY
    if center_distance <= 0.057:
        color = WHITE
    return color


def png_chunk(kind, data):
    checksum = binascii.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def render_icon(size, path, samples=4):
    rows = []
    divisor = samples * samples
    for pixel_y in range(size):
        row = bytearray([0])
        for pixel_x in range(size):
            total = [0, 0, 0]
            for sample_y in range(samples):
                y = (pixel_y + (sample_y + 0.5) / samples) / size
                for sample_x in range(samples):
                    x = (pixel_x + (sample_x + 0.5) / samples) / size
                    color = color_at(x, y)
                    total[0] += color[0]
                    total[1] += color[1]
                    total[2] += color[2]
            row.extend(round(channel / divisor) for channel in total)
        rows.append(bytes(row))

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    payload = b"".join(rows)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(payload, 9))
        + png_chunk(b"IEND", b"")
    )
    path.write_bytes(png)


for filename, icon_size in (
    ("apple-touch-icon.png", 180),
    ("icon-192.png", 192),
    ("icon-512.png", 512),
):
    render_icon(icon_size, OUTPUT / filename)
    print(f"Generated {filename} ({icon_size}x{icon_size})")
