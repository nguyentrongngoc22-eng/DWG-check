#!/usr/bin/env python3
"""Synthetic MEP-style drawing with EXACTLY known geometry, as ground truth.

Page is 1190x842 pt, user space = PDF points, no CTM games.
Dimension chain gives mmPerUnit = 30 exactly (3000 mm per 100 pt gap).
"""
import sys

W, H = 1190, 842

parts = []


def text(x, y, s, size=8):
    esc = s.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')
    parts.append(f"BT /F1 {size} Tf 1 0 0 1 {x} {y} Tm ({esc}) Tj ET")


def line(x1, y1, x2, y2, rgb=(0, 0, 0), w=1):
    r, g, b = rgb
    parts.append(f"{r} {g} {b} RG {w} w {x1} {y1} m {x2} {y2} l S")


def polyline(pts, rgb=(0, 0, 0), w=1):
    r, g, b = rgb
    d = f"{r} {g} {b} RG {w} w {pts[0][0]} {pts[0][1]} m "
    d += " ".join(f"{x} {y} l" for x, y in pts[1:])
    parts.append(d + " S")


def rect(x, y, rw, rh, rgb=(0, 0, 0), w=1):
    r, g, b = rgb
    parts.append(f"{r} {g} {b} RG {w} w {x} {y} {rw} {rh} re S")


# ---- RUN A: supply duct, horizontal, blue. Crosses RUN B at (300,600).
polyline([(100, 600), (500, 600)], rgb=(0, 0, 1), w=3)
text(140, 612, "SM_SED : 900x700")
text(140, 602, "BOD:RFL+1800")

# ---- RUN B: exhaust duct, vertical, red. Crosses RUN A at (300,600).
polyline([(300, 760), (300, 420)], rgb=(1, 0, 0), w=3)
text(305, 700, "VE_EAD : 600x400")
text(305, 690, "BOD:RFL+1850")

# ---- RUN C: chilled water, far away, green. Crosses nothing.
polyline([(700, 300), (900, 300)], rgb=(0, 0.5, 0), w=2)
text(730, 312, "CHWS-100")
text(730, 302, "BOD:RFL+2500")

# ---- dimension chain -> mmPerUnit = 3000/100 = 30
for i, x in enumerate([100, 200, 300, 400]):
    text(x, 200, "3000")

# ---- grid labels, each twice (both ends) as the app requires
for i, x in enumerate([100, 300, 500, 700]):
    text(x, 120, f"DX{i+1}")
    text(x, 800, f"DX{i+1}")
for i, y in enumerate([420, 600, 760]):
    text(60, y, f"DY{i+1}")
    text(1100, y, f"DY{i+1}")

# ---- noise: title block frame + hatching, must be filtered out
rect(950, 40, 200, 150, rgb=(0, 0, 0), w=1)
for i in range(12):
    line(960 + i * 4, 50, 960 + i * 4, 80, rgb=(0.6, 0.6, 0.6), w=0.5)

# ---- title block text
text(960, 170, "OVNC-ME-CSD-101")
text(960, 160, "A1: 1/100")
text(960, 150, "AUGUST 2025")
text(960, 140, "COMBINE SERVICES PLAN")

stream = "\n".join(parts).encode("latin-1")

objs = [
    b"<</Type/Catalog/Pages 2 0 R>>",
    b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
    (f"<</Type/Page/Parent 2 0 R/MediaBox[0 0 {W} {H}]"
     f"/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>").encode(),
    b"<</Length " + str(len(stream)).encode() + b">>\nstream\n" + stream + b"\nendstream",
    b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
]

out = bytearray(b"%PDF-1.4\n")
offsets = []
for i, body in enumerate(objs, start=1):
    offsets.append(len(out))
    out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"

xref = len(out)
out += f"xref\n0 {len(objs)+1}\n".encode()
out += b"0000000000 65535 f \n"
for off in offsets:
    out += f"{off:010d} 00000 n \n".encode()
out += (f"trailer\n<</Size {len(objs)+1}/Root 1 0 R>>\nstartxref\n{xref}\n"
        "%%EOF\n").encode()

path = sys.argv[1] if len(sys.argv) > 1 else "test.pdf"
with open(path, "wb") as f:
    f.write(bytes(out))
print(f"wrote {path} ({len(out)} bytes)")


# ---------------------------------------------------------------------------
# Fixture 2: the same clash, but reached through a CTM scale and a form
# XObject with its own /Matrix — the way real CAD exports nest their content.
# ---------------------------------------------------------------------------

def build_transformed(path="test2.pdf"):
    s1 = [
        "q 2 0 0 2 0 0 cm",
        "0 0 1 RG 3 w 50 200 m 250 200 l S",                     # -> (100,400)-(500,400)
        "BT /F1 4 Tf 1 0 0 1 70 206 Tm (SM_SED : 900x700) Tj ET",  # -> (140,412)
        "BT /F1 4 Tf 1 0 0 1 70 201 Tm (BOD:RFL+1800) Tj ET",      # -> (140,402)
        "Q",
    ]
    form = "\n".join([
        "1 0 0 RG 3 w 100 300 m 100 700 l S",                    # -> x=300, y 300..700
        "BT /F1 8 Tf 1 0 0 1 105 600 Tm (VE_EAD : 600x400) Tj ET",
        "BT /F1 8 Tf 1 0 0 1 105 590 Tm (BOD:RFL+1850) Tj ET",
    ]).encode("latin-1")

    top = ["q 1 0 0 1 0 0 cm /X1 Do Q"]
    for x in [100, 200, 300, 400]:
        top.append(f"BT /F1 8 Tf 1 0 0 1 {x} 200 Tm (3000) Tj ET")
    for i, x in enumerate([100, 300, 500, 700]):
        for y in (120, 800):
            top.append(f"BT /F1 8 Tf 1 0 0 1 {x} {y} Tm (DX{i+1}) Tj ET")
    for i, y in enumerate([420, 600, 760]):
        for x in (60, 1100):
            top.append(f"BT /F1 8 Tf 1 0 0 1 {x} {y} Tm (DY{i+1}) Tj ET")
    top.append("BT /F1 8 Tf 1 0 0 1 960 170 Tm (OVNC-ME-CSD-202) Tj ET")
    top.append("BT /F1 8 Tf 1 0 0 1 960 160 Tm (A1: 1/100) Tj ET")
    top.append("BT /F1 8 Tf 1 0 0 1 960 150 Tm (COMBINE SERVICES PLAN) Tj ET")

    stream = ("\n".join(s1 + top)).encode("latin-1")
    objs = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        (f"<</Type/Page/Parent 2 0 R/MediaBox[0 0 {W} {H}]/Resources<</Font<</F1 5 0 R>>"
         f"/XObject<</X1 6 0 R>>>>/Contents 4 0 R>>").encode(),
        b"<</Length " + str(len(stream)).encode() + b">>\nstream\n" + stream + b"\nendstream",
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
        (b"<</Type/XObject/Subtype/Form/BBox[0 0 " + str(W).encode() + b" " + str(H).encode() +
         b"]/Matrix[1 0 0 1 200 0]/Resources<</Font<</F1 5 0 R>>>>/Length " +
         str(len(form)).encode() + b">>\nstream\n" + form + b"\nendstream"),
    ]
    out = bytearray(b"%PDF-1.4\n")
    offs = []
    for i, body in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n".encode() + b"0000000000 65535 f \n"
    for o in offs:
        out += f"{o:010d} 00000 n \n".encode()
    out += f"trailer\n<</Size {len(objs)+1}/Root 1 0 R>>\nstartxref\n{xref}\n%%EOF\n".encode()
    with open(path, "wb") as f:
        f.write(bytes(out))
    print(f"wrote {path} ({len(out)} bytes)")


build_transformed(sys.argv[2] if len(sys.argv) > 2 else "test2.pdf")
