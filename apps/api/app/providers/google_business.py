"""Google Business Profile API client (official endpoints only — no scraping).

APIs used (must be enabled in the Google Cloud project, and Business Profile API access
must be approved by Google for the project):
  - My Business Account Management API v1   — accounts
  - My Business Business Information API v1 — locations
  - Google My Business API v4               — reviews list + reply (accounts/*/locations/*/reviews)
Scope: https://www.googleapis.com/auth/business.manage
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx

from app.core.config import settings

log = logging.getLogger("reviewpilot.google")

SCOPE = "https://www.googleapis.com/auth/business.manage openid email"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
LOCATIONS_URL = "https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations"
REVIEWS_URL = "https://mybusiness.googleapis.com/v4/{account}/{location}/reviews"
REPLY_URL = "https://mybusiness.googleapis.com/v4/{review_name}/reply"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

STAR = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}


class GoogleAPIError(Exception):
    def __init__(self, message: str, status: int | None = None, reauth: bool = False):
        super().__init__(message)
        self.status, self.reauth = status, reauth


def authorize_url(state: str, challenge: str) -> str:
    return f"{AUTH_URL}?" + urlencode(
        {
            "client_id": settings.google_client_id, "redirect_uri": settings.gbp_redirect_uri, "response_type": "code", "scope": SCOPE,
            "state": state, "access_type": "offline", "prompt": "consent", "include_granted_scopes": "true",
            "code_challenge": challenge, "code_challenge_method": "S256",
        }
    )


async def exchange_code(code: str, verifier: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(TOKEN_URL, data={
            "code": code, "client_id": settings.google_client_id, "client_secret": settings.google_client_secret,
            "redirect_uri": settings.gbp_redirect_uri, "grant_type": "authorization_code", "code_verifier": verifier,
        })
    if res.status_code != 200:
        raise GoogleAPIError(f"Token exchange failed: {res.text[:300]}", res.status_code)
    return res.json()


async def refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(TOKEN_URL, data={"client_id": settings.google_client_id, "client_secret": settings.google_client_secret, "refresh_token": refresh_token, "grant_type": "refresh_token"})
    if res.status_code != 200:
        body = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        raise GoogleAPIError(f"Token refresh failed: {body.get('error', res.status_code)}", res.status_code, reauth=body.get("error") == "invalid_grant")
    return res.json()


async def revoke(token: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(REVOKE_URL, params={"token": token})


def expiry(token_response: dict) -> datetime:
    return datetime.now(UTC) + timedelta(seconds=int(token_response.get("expires_in", 3600)) - 60)


class GBPClient:
    def __init__(self, access_token: str):
        self.headers = {"Authorization": f"Bearer {access_token}"}

    async def _get(self, url: str, params: dict | None = None, retries: int = 3) -> dict:
        for attempt in range(retries):
            async with httpx.AsyncClient(timeout=30) as client:
                res = await client.get(url, params=params, headers=self.headers)
            if res.status_code == 429 or res.status_code >= 500:
                await asyncio.sleep(2 ** attempt)
                continue
            if res.status_code == 401:
                raise GoogleAPIError("Access token expired or revoked", 401, reauth=True)
            if res.status_code == 403:
                raise GoogleAPIError("Business Profile API access denied. Ensure the API is enabled and your project is approved by Google.", 403)
            if res.status_code >= 400:
                raise GoogleAPIError(f"Google API error {res.status_code}: {res.text[:300]}", res.status_code)
            return res.json()
        raise GoogleAPIError("Google API quota/availability error after retries", 429)

    async def userinfo(self) -> dict:
        return await self._get(USERINFO_URL)

    async def list_accounts(self) -> list[dict]:
        out, token = [], None
        while True:
            data = await self._get(ACCOUNTS_URL, {"pageSize": 20, **({"pageToken": token} if token else {})})
            out.extend(data.get("accounts", []))
            token = data.get("nextPageToken")
            if not token:
                return out

    async def list_locations(self, account_name: str) -> list[dict]:
        out, token = [], None
        while True:
            data = await self._get(LOCATIONS_URL.format(account=account_name), {"pageSize": 100, "readMask": "name,title,storefrontAddress,metadata,phoneNumbers", **({"pageToken": token} if token else {})})
            out.extend(data.get("locations", []))
            token = data.get("nextPageToken")
            if not token:
                return out

    async def list_reviews(self, account_name: str, location_name: str, max_pages: int = 20) -> list[dict]:
        """location_name is 'locations/{id}' from Business Information API."""
        out, token = [], None
        for _ in range(max_pages):
            data = await self._get(REVIEWS_URL.format(account=account_name, location=location_name), {"pageSize": 50, "orderBy": "updateTime desc", **({"pageToken": token} if token else {})})
            out.extend(data.get("reviews", []))
            token = data.get("nextPageToken")
            if not token:
                break
        return out

    async def put_reply(self, review_name: str, comment: str) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.put(REPLY_URL.format(review_name=review_name), json={"comment": comment}, headers=self.headers)
        if res.status_code == 401:
            raise GoogleAPIError("Access token expired", 401, reauth=True)
        if res.status_code >= 400:
            raise GoogleAPIError(f"Reply failed: {res.text[:300]}", res.status_code)
        return res.json()


def parse_review(raw: dict) -> dict:
    reply = raw.get("reviewReply") or {}
    reviewer = raw.get("reviewer") or {}
    return {
        "external_id": raw.get("name") or raw.get("reviewId"),
        "reviewer_name": None if reviewer.get("isAnonymous") else reviewer.get("displayName"),
        "reviewer_photo_url": reviewer.get("profilePhotoUrl"),
        "rating": STAR.get(raw.get("starRating", ""), 0),
        "comment": raw.get("comment"),
        "review_created_at": datetime.fromisoformat(raw["createTime"].replace("Z", "+00:00")),
        "review_updated_at": datetime.fromisoformat(raw["updateTime"].replace("Z", "+00:00")) if raw.get("updateTime") else None,
        "platform_reply": reply.get("comment"),
        "platform_reply_at": datetime.fromisoformat(reply["updateTime"].replace("Z", "+00:00")) if reply.get("updateTime") else None,
    }
