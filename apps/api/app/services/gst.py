"""GST helpers: GSTIN validation (format + checksum) and intra/inter-state tax split."""

from __future__ import annotations

import re

from app.core.config import settings

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

STATES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
    "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
    "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
    "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu",
    "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
}


def gstin_checksum_ok(gstin: str) -> bool:
    total = 0
    for i, ch in enumerate(gstin[:14]):
        v = _CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += v // 36 + v % 36
    return _CHARS[(36 - total % 36) % 36] == gstin[14]


def validate_gstin(gstin: str) -> str:
    g = gstin.strip().upper()
    if not GSTIN_RE.match(g) or g[:2] not in STATES:
        raise ValueError("Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5)")
    if not gstin_checksum_ok(g):
        raise ValueError("This GSTIN's check digit doesn't match — please re-check it")
    return g


def tax_split(amount_inclusive_minor: int, buyer_state_code: str | None, rate: int = 18) -> dict:
    """Split a GST-inclusive amount. Same state as the seller → CGST+SGST, otherwise IGST."""
    tax = round(amount_inclusive_minor * rate / (100 + rate))
    taxable = amount_inclusive_minor - tax
    seller = settings.company_state_code
    if seller and buyer_state_code and seller == buyer_state_code:
        half = tax // 2
        return {"taxable_minor": taxable, "tax_minor": tax, "lines": [{"name": f"CGST {rate // 2}%", "amount_minor": half}, {"name": f"SGST {rate // 2}%", "amount_minor": tax - half}], "place_of_supply": STATES.get(buyer_state_code)}
    return {"taxable_minor": taxable, "tax_minor": tax, "lines": [{"name": f"IGST {rate}%", "amount_minor": tax}], "place_of_supply": STATES.get(buyer_state_code) if buyer_state_code else None}
