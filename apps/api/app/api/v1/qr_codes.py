from __future__ import annotations

import hashlib
import secrets
import string
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, update

from app.core.config import settings
from app.core.deps import DB, Org, OrgContext, require_perm
from app.core.errors import NotFound
from app.core.permissions import Perm
from app.core.ratelimit import client_ip, hit
from app.core.security import now
from app.models import Location, QRCode, QRScan
from app.providers.storage import read_url, save_image
from app.schemas.common import ORM
from app.services import audit
from app.services.locations import get_location, scoped_location_filter
from app.services.qr_render import render_pdf, render_png, render_svg, scan_url

router = APIRouter(prefix="/qr-codes", tags=["qr-codes"])
ALPHABET = string.ascii_letters + string.digits
HEX = r"^#[0-9a-fA-F]{6}$"


class QRIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    location_id: uuid.UUID
    campaign_id: uuid.UUID | None = None
    foreground: str = Field("#16112b", pattern=HEX)
    background: str = Field("#ffffff", pattern=HEX)
    template: str = Field("classic", pattern="^(classic|minimal|bold)$")
    card_headline: str | None = Field(None, max_length=160)
    card_subtext: str | None = Field(None, max_length=255)

    @field_validator("background")
    @classmethod
    def _contrast(cls, v, info):
        fg = info.data.get("foreground", "#000000")

        def lum(h):
            r, g, b = (int(h[i : i + 2], 16) / 255 for i in (1, 3, 5))
            return 0.2126 * r + 0.7152 * g + 0.0722 * b

        if abs(lum(fg) - lum(v)) < 0.4:
            raise ValueError("Foreground and background need more contrast to scan reliably")
        return v


class QRUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=160)
    foreground: str | None = Field(None, pattern=HEX)
    background: str | None = Field(None, pattern=HEX)
    template: str | None = Field(None, pattern="^(classic|minimal|bold)$")
    card_headline: str | None = Field(None, max_length=160)
    card_subtext: str | None = Field(None, max_length=255)


class QROut(ORM):
    id: uuid.UUID
    name: str
    code: str
    location_id: uuid.UUID
    location_name: str | None = None
    campaign_id: uuid.UUID | None
    foreground: str
    background: str
    template: str
    logo_url: str | None
    card_headline: str | None
    card_subtext: str | None
    scan_count: int
    last_scanned_at: datetime | None
    created_at: datetime
    scan_url: str = ""
    scans_7d: int = 0


async def _get(db, ctx: OrgContext, qr_id: uuid.UUID) -> QRCode:
    qr = await db.get(QRCode, qr_id)
    if qr is None or qr.organization_id != ctx.org_id or qr.deleted_at is not None:
        raise NotFound("QR code not found")
    ctx.ensure_location(qr.location_id)
    return qr


async def _out(db, qrs: list[QRCode]) -> list[QROut]:
    if not qrs:
        return []
    ids = [q.id for q in qrs]
    recent = dict((await db.execute(select(QRScan.qr_code_id, func.count()).where(QRScan.qr_code_id.in_(ids), QRScan.scanned_at >= now() - timedelta(days=7)).group_by(QRScan.qr_code_id))).all())
    locs = dict((await db.execute(select(Location.id, Location.name).where(Location.id.in_({q.location_id for q in qrs})))).all())
    return [QROut.model_validate(q).model_copy(update={"scan_url": scan_url(q), "scans_7d": recent.get(q.id, 0), "location_name": locs.get(q.location_id)}) for q in qrs]


@router.get("", response_model=list[QROut])
async def list_qr(ctx: Org, db: DB, location_id: uuid.UUID | None = None):
    stmt = select(QRCode).where(QRCode.organization_id == ctx.org_id, QRCode.deleted_at.is_(None), scoped_location_filter(ctx, QRCode.location_id))
    if location_id:
        stmt = stmt.where(QRCode.location_id == location_id)
    return await _out(db, list((await db.scalars(stmt.order_by(QRCode.created_at.desc()))).all()))


@router.post("", response_model=QROut, status_code=201)
async def create_qr(data: QRIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    await get_location(db, ctx, data.location_id)
    code = "".join(secrets.choice(ALPHABET) for _ in range(8))
    qr = QRCode(organization_id=ctx.org_id, code=code, **data.model_dump())
    db.add(qr)
    await db.flush()
    await audit.record(db, "qr.created", actor=ctx.user, organization_id=ctx.org_id, target_type="qr_code", target_id=qr.id, request=request)
    await db.commit()
    return (await _out(db, [qr]))[0]


@router.get("/{qr_id}", response_model=QROut)
async def get_qr(qr_id: uuid.UUID, ctx: Org, db: DB):
    return (await _out(db, [await _get(db, ctx, qr_id)]))[0]


@router.patch("/{qr_id}", response_model=QROut)
async def update_qr(qr_id: uuid.UUID, data: QRUpdate, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    qr = await _get(db, ctx, qr_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(qr, k, v)
    await db.commit()
    return (await _out(db, [qr]))[0]


@router.post("/{qr_id}/logo", response_model=QROut)
async def upload_logo(qr_id: uuid.UUID, db: DB, file: UploadFile = File(...), ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    qr = await _get(db, ctx, qr_id)
    qr.logo_url = await save_image(file, f"qr/{ctx.org_id}", 400)
    await db.commit()
    return (await _out(db, [qr]))[0]


@router.delete("/{qr_id}/logo", response_model=QROut)
async def remove_logo(qr_id: uuid.UUID, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    qr = await _get(db, ctx, qr_id)
    qr.logo_url = None
    await db.commit()
    return (await _out(db, [qr]))[0]


@router.delete("/{qr_id}", status_code=204)
async def delete_qr(qr_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    qr = await _get(db, ctx, qr_id)
    qr.deleted_at = now()
    await audit.record(db, "qr.deleted", actor=ctx.user, organization_id=ctx.org_id, target_type="qr_code", target_id=qr.id, request=request)
    await db.commit()


@router.get("/{qr_id}/download")
async def download(qr_id: uuid.UUID, ctx: Org, db: DB, format: str = Query("png", pattern="^(png|svg|pdf)$")):
    qr = await _get(db, ctx, qr_id)
    logo = await read_url(qr.logo_url or ctx.organization.logo_url) if (qr.logo_url or ctx.organization.logo_url) else None
    fname = f"{ctx.organization.slug}-{qr.code}"
    if format == "svg":
        return Response(render_svg(qr), media_type="image/svg+xml", headers={"Content-Disposition": f'attachment; filename="{fname}.svg"'})
    if format == "pdf":
        loc = await db.get(Location, qr.location_id)
        pdf = render_pdf(qr, business=ctx.organization.name, location=loc.name if loc else "", brand_color=ctx.organization.brand_color, logo_bytes=logo)
        return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}-card.pdf"'})
    return Response(render_png(qr, logo), media_type="image/png", headers={"Content-Disposition": f'attachment; filename="{fname}.png"'})


@router.get("/{qr_id}/preview.svg")
async def preview_svg(qr_id: uuid.UUID, ctx: Org, db: DB):
    qr = await _get(db, ctx, qr_id)
    return Response(render_svg(qr, scale=8), media_type="image/svg+xml", headers={"Cache-Control": "private, max-age=60"})


@router.get("/{qr_id}/scans")
async def scan_series(qr_id: uuid.UUID, ctx: Org, db: DB, days: int = Query(30, ge=7, le=365)):
    qr = await _get(db, ctx, qr_id)
    day = func.date_trunc("day", QRScan.scanned_at)
    rows = (await db.execute(select(day, func.count(), func.count(func.distinct(QRScan.ip_hash))).where(QRScan.qr_code_id == qr.id, QRScan.scanned_at >= now() - timedelta(days=days)).group_by(day).order_by(day))).all()
    devices = dict((await db.execute(select(QRScan.device, func.count()).where(QRScan.qr_code_id == qr.id).group_by(QRScan.device))).all())
    return {"series": [{"date": d.date().isoformat(), "scans": n, "unique": u} for d, n, u in rows], "devices": devices, "total": qr.scan_count}


@router.get("/scan/{code}", include_in_schema=False)
async def scan(code: str, request: Request, db: DB):
    """First-party redirect: count the scan, then send everyone to the same honest feedback page."""
    qr = await db.scalar(select(QRCode).where(QRCode.code == code, QRCode.deleted_at.is_(None)))
    if qr is None:
        return RedirectResponse(f"{settings.frontend_url}/", status_code=302)
    loc = await db.get(Location, qr.location_id)
    ip = client_ip(request)
    allowed, _ = await hit(f"qrscan:{qr.id}:{ip}", 5, 60)  # de-duplicate rapid re-scans
    if allowed:
        ua = (request.headers.get("user-agent") or "").lower()
        device = "ios" if "iphone" in ua or "ipad" in ua else "android" if "android" in ua else "desktop" if ua else "unknown"
        db.add(QRScan(qr_code_id=qr.id, organization_id=qr.organization_id, scanned_at=now(), device=device, ip_hash=hashlib.sha256(f"{settings.secret_key}:{ip}".encode()).hexdigest()))
        await db.execute(update(QRCode).where(QRCode.id == qr.id).values(scan_count=QRCode.scan_count + 1, last_scanned_at=now()))
        await db.commit()
    return RedirectResponse(f"{settings.frontend_url}/r/{loc.slug if loc else ''}?qr={qr.code}", status_code=302)
