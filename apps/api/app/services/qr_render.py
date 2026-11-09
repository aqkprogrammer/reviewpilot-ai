"""QR rendering: PNG (optional centred logo), SVG and a printable A6 table-card PDF."""

from __future__ import annotations

import io

import segno
from PIL import Image, ImageDraw
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A6
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.models import QRCode


def scan_url(qr: QRCode) -> str:
    return f"{settings.frontend_url}/q/{qr.code}"


def _qr(qr: QRCode, logo: bool) -> segno.QRCode:
    # High error correction leaves room for a centred logo.
    return segno.make(scan_url(qr), error="h" if logo else "m", micro=False)


def render_svg(qr: QRCode, scale: int = 10) -> bytes:
    buf = io.BytesIO()
    _qr(qr, False).save(buf, kind="svg", scale=scale, border=2, dark=qr.foreground, light=qr.background, xmldecl=False, svgclass=None, lineclass=None)
    return buf.getvalue()


def render_png(qr: QRCode, logo_bytes: bytes | None = None, scale: int = 16) -> bytes:
    buf = io.BytesIO()
    _qr(qr, bool(logo_bytes)).save(buf, kind="png", scale=scale, border=2, dark=qr.foreground, light=qr.background)
    img = Image.open(io.BytesIO(buf.getvalue())).convert("RGBA")
    if logo_bytes:
        try:
            logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
            side = int(img.width * 0.22)
            logo.thumbnail((side, side))
            pad = int(side * 0.18)
            plate = Image.new("RGBA", (logo.width + pad * 2, logo.height + pad * 2), (0, 0, 0, 0))
            ImageDraw.Draw(plate).rounded_rectangle([0, 0, plate.width - 1, plate.height - 1], radius=pad, fill=qr.background)
            plate.alpha_composite(logo, (pad, pad))
            img.alpha_composite(plate, ((img.width - plate.width) // 2, (img.height - plate.height) // 2))
        except OSError:
            pass
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def render_pdf(qr: QRCode, *, business: str, location: str, brand_color: str, logo_bytes: bytes | None = None) -> bytes:
    """A6 printable card. Copy invites honest feedback — never only positive reviews."""
    buf = io.BytesIO()
    w, h = A6
    c = canvas.Canvas(buf, pagesize=A6)
    c.setTitle(f"{business} — feedback QR")
    accent = HexColor(brand_color if brand_color.startswith("#") else "#0e9aa7")
    dark = HexColor("#0b1218")
    if qr.template == "bold":
        c.setFillColor(accent)
        c.rect(0, 0, w, h, stroke=0, fill=1)
        c.setFillColor(HexColor("#ffffff"))
        c.roundRect(18, 70, w - 36, h - 150, 14, stroke=0, fill=1)
        text_color, sub_color = HexColor("#ffffff"), HexColor("#d9f6f7")
    else:
        c.setFillColor(HexColor("#ffffff"))
        c.rect(0, 0, w, h, stroke=0, fill=1)
        c.setFillColor(accent)
        c.rect(0, h - 6, w, 6, stroke=0, fill=1)
        text_color, sub_color = dark, HexColor("#52616c")
        if qr.template == "classic":
            c.setStrokeColor(HexColor("#dde5e9"))
            c.roundRect(12, 12, w - 24, h - 24, 12, stroke=1, fill=0)
    headline = qr.card_headline or "How was your visit?"
    sub = qr.card_subtext or "Scan to share honest feedback"
    if qr.template == "bold":
        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(w / 2, h - 40, headline[:34])
        c.setFont("Helvetica", 9)
        c.setFillColor(sub_color)
        c.drawCentredString(w / 2, h - 56, sub[:60])
    else:
        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(w / 2, h - 32, business[:40])
        c.setFont("Helvetica-Bold", 17)
        c.drawCentredString(w / 2, h - 56, headline[:32])
        c.setFont("Helvetica", 9)
        c.setFillColor(sub_color)
        c.drawCentredString(w / 2, h - 72, sub[:60])
    png = render_png(qr, logo_bytes, scale=12)
    size = w - 96
    c.drawImage(ImageReader(io.BytesIO(png)), (w - size) / 2, 88 if qr.template == "bold" else 72, size, size, mask="auto")
    c.setFont("Helvetica", 7.5)
    c.setFillColor(HexColor("#ffffff") if qr.template == "bold" else sub_color)
    c.drawCentredString(w / 2, 46 if qr.template == "bold" else 46, f"{location[:48]}")
    c.drawCentredString(w / 2, 34, "Every review — positive or negative — is welcome.")
    c.drawCentredString(w / 2, 22, scan_url(qr).replace("https://", "").replace("http://", "")[:60])
    c.showPage()
    c.save()
    return buf.getvalue()
