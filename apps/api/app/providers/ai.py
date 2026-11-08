"""LLM providers.

`OpenAIProvider` calls the Chat Completions API server-side (keys never reach the browser).
`HeuristicProvider` is an offline, deterministic fallback used when OPENAI_API_KEY is absent.
Its outputs are labelled `provider="heuristic"` everywhere so they are never mistaken for
model output.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings

# USD per 1M tokens (input, output). Used for cost estimates in admin reporting.
MODEL_PRICING = {
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
}


@dataclass
class AIResult:
    data: dict[str, Any]
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
    cost_usd: float = 0.0
    raw: dict = field(default_factory=dict)


class AIProviderError(Exception):
    pass


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key, self.model, self.base_url = api_key, model, base_url.rstrip("/")

    async def complete_json(self, system: str, user: str, *, temperature: float = 0.4, max_tokens: int = 800) -> AIResult:
        started = time.perf_counter()
        payload = {
            "model": self.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        try:
            async with httpx.AsyncClient(timeout=45) as client:
                res = await client.post(f"{self.base_url}/chat/completions", json=payload, headers={"Authorization": f"Bearer {self.api_key}"})
        except httpx.HTTPError as exc:
            raise AIProviderError(f"OpenAI request failed: {exc}") from exc
        if res.status_code == 429:
            raise AIProviderError("OpenAI rate limit reached. Try again shortly.")
        if res.status_code >= 400:
            raise AIProviderError(f"OpenAI error {res.status_code}: {res.text[:300]}")
        body = res.json()
        content = body["choices"][0]["message"]["content"]
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise AIProviderError("Model returned invalid JSON") from exc
        usage = body.get("usage", {})
        pin, pout = MODEL_PRICING.get(self.model, (1.0, 3.0))
        pt, ct = usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
        return AIResult(
            data=data, provider=self.name, model=self.model, prompt_tokens=pt, completion_tokens=ct,
            latency_ms=int((time.perf_counter() - started) * 1000), cost_usd=(pt * pin + ct * pout) / 1_000_000,
        )


# ------------------------------------------------------------------ heuristic fallback

POSITIVE = {
    "great", "excellent", "amazing", "awesome", "good", "best", "love", "loved", "friendly", "clean", "delicious", "tasty",
    "helpful", "professional", "quick", "fast", "polite", "recommend", "wonderful", "perfect", "nice", "comfortable",
    "caring", "fantastic", "smooth", "courteous", "fresh", "accha", "achha", "badhiya", "bahut", "mast", "shandar",
    "zabardast", "सुंदर", "अच्छा", "बढ़िया", "शानदार", "बेहतरीन",
}
NEGATIVE = {
    "bad", "worst", "terrible", "rude", "dirty", "slow", "late", "delay", "delayed", "cold", "expensive", "overpriced",
    "poor", "horrible", "disappointed", "disappointing", "unprofessional", "waited", "waiting", "never", "awful", "issue",
    "problem", "bekar", "bakwas", "ganda", "kharab", "der", "बेकार", "खराब", "गंदा", "देर",
}
TOPICS = {
    "wait_time": ["wait", "waited", "waiting", "delay", "delayed", "late", "slow", "queue", "der", "देर", "time"],
    "staff": ["staff", "waiter", "receptionist", "team", "doctor", "nurse", "stylist", "manager", "rude", "polite", "friendly", "helpful", "behaviour", "behavior"],
    "cleanliness": ["clean", "dirty", "hygiene", "hygienic", "neat", "smell", "ganda", "saaf"],
    "quality": ["quality", "taste", "tasty", "delicious", "food", "treatment", "haircut", "service", "fresh"],
    "price": ["price", "expensive", "cheap", "value", "overpriced", "cost", "bill", "paisa"],
    "ambience": ["ambience", "ambiance", "music", "decor", "atmosphere", "vibe", "comfortable"],
    "booking": ["booking", "appointment", "reservation", "schedule", "slot"],
    "parking": ["parking", "park"],
}
TOPIC_LABELS = {
    "wait_time": "wait times", "staff": "staff behaviour", "cleanliness": "cleanliness", "quality": "service quality",
    "price": "pricing and value", "ambience": "ambience", "booking": "booking experience", "parking": "parking",
}


def heuristic_sentiment(text: str | None, rating: int | None = None) -> tuple[str, float, list[str]]:
    words = re.findall(r"[\wऀ-ॿ]+", (text or "").lower())
    pos = sum(w in POSITIVE for w in words)
    neg = sum(w in NEGATIVE for w in words)
    score = 0.0
    if words:
        score = (pos - neg) / max(1, pos + neg)
    if rating is not None:
        score = 0.6 * ((rating - 3) / 2) + 0.4 * score
    label = "positive" if score > 0.25 else "negative" if score < -0.25 else "neutral"
    if pos and neg and abs(score) < 0.5:
        label = "mixed"
    topics = [t for t, kws in TOPICS.items() if any(k in words for k in kws)]
    return label, round(score, 3), topics


class HeuristicProvider:
    """Deterministic, template-based generator for development without an API key."""

    name = "heuristic"
    model = "reviewpilot-heuristic-v1"

    def reply(self, *, review_text: str | None, rating: int, reviewer: str | None, business: str, tone: str, language: str) -> dict:
        sentiment, _, topics = heuristic_sentiment(review_text, rating)
        first = (reviewer or "").split(" ")[0] if reviewer else None
        topic_phrase = TOPIC_LABELS.get(topics[0]) if topics else None
        if language == "hi":
            name = f"{first} जी" if first else "प्रिय ग्राहक"
            if rating >= 4:
                body = f"{name}, {business} को इतनी अच्छी समीक्षा देने के लिए हार्दिक धन्यवाद! हमें खुशी है कि आपको हमारा अनुभव पसंद आया। जल्द ही फिर मिलेंगे।"
            elif rating == 3:
                body = f"{name}, आपकी प्रतिक्रिया के लिए धन्यवाद। हम आपके अनुभव को और बेहतर बनाने पर काम कर रहे हैं और आपके सुझावों की सराहना करते हैं।"
            else:
                body = f"{name}, हमें खेद है कि आपका अनुभव हमारी अपेक्षाओं के अनुरूप नहीं रहा। कृपया हमसे सीधे संपर्क करें ताकि हम इसे ठीक कर सकें।"
        elif language == "hinglish":
            name = first or "aap"
            if rating >= 4:
                body = f"Thank you so much {name}! {business} ke baare mein itna accha review dene ke liye shukriya. Aapse jaldi phir milne ka intezaar rahega!"
            elif rating == 3:
                body = f"Thanks {name} for the honest feedback. Hum{' ' + topic_phrase + ' par' if topic_phrase else ''} kaam kar rahe hain taaki agli baar aapka experience aur accha ho."
            else:
                body = f"Hi {name}, humein sach mein afsos hai ki aapka experience accha nahi raha. Please humse directly contact kijiye — hum isse theek karna chahte hain."
        else:
            greet = f"Hi {first}," if first else "Hello,"
            if tone == "concise":
                body = (
                    f"{greet} thank you for the {rating}-star review — we're glad you enjoyed {business}!" if rating >= 4
                    else f"{greet} thank you for the feedback. We're sorry we fell short and would like to make it right — please contact us directly."
                )
            elif rating >= 4:
                opener = {
                    "friendly": f"{greet} thank you so much for the lovely review!",
                    "appreciative": f"{greet} we truly appreciate you taking the time to share this.",
                    "empathetic": f"{greet} thank you for sharing such a warm experience with us.",
                }.get(tone, f"{greet} thank you for your kind review of {business}.")
                mid = f" It's great to hear you noticed our {topic_phrase}." if topic_phrase else " Your words mean a lot to our team."
                body = f"{opener}{mid} We look forward to welcoming you again soon."
            elif rating == 3:
                mid = f" We hear you on {topic_phrase} and are already looking into it." if topic_phrase else " We'd love to understand what would have made your visit better."
                body = f"{greet} thank you for the honest feedback.{mid} We hope to give you a five-star experience next time."
            else:
                apology = "We're truly sorry" if tone in ("empathetic", "apologetic") else "We apologise"
                mid = f" regarding {topic_phrase}" if topic_phrase else ""
                body = (
                    f"{greet} {apology} that your experience{mid} didn't meet expectations. This isn't the standard we aim for. "
                    "Please reach out to us directly so we can understand what happened and make it right."
                )
        follow_up = (
            "Contact the customer privately to resolve the issue; avoid discussing details publicly." if rating <= 2
            else "Share the praise with the team." if rating >= 4 else "Review the feedback with the location manager."
        )
        return {
            "reply": body,
            "explanation": f"Template reply for a {rating}-star review in a {tone} tone" + (f", acknowledging {topic_phrase}" if topic_phrase else "") + ".",
            "sentiment": sentiment,
            "keywords": topics,
            "follow_up": follow_up,
        }


def get_llm() -> OpenAIProvider | None:
    if settings.openai_configured:
        return OpenAIProvider(settings.openai_api_key or "", settings.openai_model, settings.openai_base_url)
    return None
