"""Operational CLI.

  python -m app.cli seed                 # plans, templates, flags (safe everywhere)
  python -m app.cli seed-demo            # sample data — development only
  python -m app.cli create-super-admin --email you@company.com --name "Your Name" --secret $SUPER_ADMIN_BOOTSTRAP_SECRET
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import hmac
import sys

from app.core.config import settings
from app.core.db import SessionLocal, engine
from app.schemas.auth import validate_password_strength
from app.seed import bootstrap_super_admin, seed_demo, seed_reference_data


async def _run(args: argparse.Namespace) -> int:
    async with SessionLocal() as db:
        if args.cmd == "seed":
            await seed_reference_data(db)
            print("Reference data seeded (plans, templates, feature flags, settings).")
        elif args.cmd == "seed-demo":
            if settings.is_production:
                print("Refusing: demo data cannot be seeded in production.", file=sys.stderr)
                return 1
            print(await seed_demo(db))
        elif args.cmd == "create-super-admin":
            expected = settings.super_admin_bootstrap_secret
            if not expected or len(expected) < 16:
                print("Set SUPER_ADMIN_BOOTSTRAP_SECRET (16+ chars) in the environment first.", file=sys.stderr)
                return 1
            if not args.secret or not hmac.compare_digest(args.secret, expected):
                print("Bootstrap secret mismatch.", file=sys.stderr)
                return 1
            if settings.super_admin_email and args.email.lower() != settings.super_admin_email.lower():
                print("Email must match SUPER_ADMIN_EMAIL.", file=sys.stderr)
                return 1
            password = args.password or getpass.getpass("Password for the Super Admin: ")
            try:
                validate_password_strength(password)
            except ValueError as exc:
                print(str(exc), file=sys.stderr)
                return 1
            user = await bootstrap_super_admin(db, args.email, args.name, password)
            print(f"Super Admin ready: {user.email}. Rotate SUPER_ADMIN_BOOTSTRAP_SECRET now.")
    await engine.dispose()
    return 0


def main() -> None:
    p = argparse.ArgumentParser(prog="reviewpilot")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("seed")
    sub.add_parser("seed-demo")
    s = sub.add_parser("create-super-admin")
    s.add_argument("--email", required=True)
    s.add_argument("--name", default="Platform Admin")
    s.add_argument("--secret", required=True)
    s.add_argument("--password")
    raise SystemExit(asyncio.run(_run(p.parse_args())))


if __name__ == "__main__":
    main()
