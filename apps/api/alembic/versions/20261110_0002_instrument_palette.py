"""Move legacy purple defaults to the Instrument palette.

Organizations still on the old default brand colour (#6a4cff) and QR codes on the old
default ink (#16112b) are updated. Custom colours chosen by businesses are untouched.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-10
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE organizations SET brand_color = '#0e9aa7' WHERE lower(brand_color) = '#6a4cff'")
    op.execute("UPDATE qr_codes SET foreground = '#0b1218' WHERE lower(foreground) = '#16112b'")


def downgrade() -> None:
    op.execute("UPDATE organizations SET brand_color = '#6a4cff' WHERE lower(brand_color) = '#0e9aa7'")
    op.execute("UPDATE qr_codes SET foreground = '#16112b' WHERE lower(foreground) = '#0b1218'")
