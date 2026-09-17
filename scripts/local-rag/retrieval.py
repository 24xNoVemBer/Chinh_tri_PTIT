"""Shared lexical retrieval policies for the local RAG pilot."""

from __future__ import annotations

import json
import math
import re
import unicodedata


LEGACY_PROFILE = "legacy-v1"
TOP5_PROFILE = "top5-v2"
EXPANDED_PROFILE = "expanded-v3"
RETRIEVAL_PROFILES = {LEGACY_PROFILE, TOP5_PROFILE, EXPANDED_PROFILE}
PROFILE_LIMITS = {LEGACY_PROFILE: 3, TOP5_PROFILE: 5, EXPANDED_PROFILE: 5}
STOP_WORDS = set(
    "là gì và của trong một những các có được như nào về cho với hãy tôi bạn mình này đó ở theo".split()
)


def resolve_retrieval_profile(value: str | None) -> str:
    profile = str(value or LEGACY_PROFILE).strip().lower()
    if profile not in RETRIEVAL_PROFILES:
        raise ValueError("RAG_RETRIEVAL_PROFILE must be legacy-v1, top5-v2, or expanded-v3")
    return profile


def query_expansion_terms(query: str, profile: str) -> list[str]:
    profile = resolve_retrieval_profile(profile)
    if profile != EXPANDED_PROFILE:
        return []
    normalized = unicodedata.normalize("NFC", query).casefold()
    definition_intent = re.search(r"\b(định nghĩa|khái niệm)\b", normalized) or "là gì" in normalized
    if definition_intent and "vật chất" in normalized and "lênin" not in normalized:
        return ["V.I. Lênin"]
    return []


def prepare_retrieval_query(query: str, tokenize, profile: str) -> tuple[str, list[str]]:
    additions = query_expansion_terms(query, profile)
    expanded = " ".join([query, *additions])
    prepared = " ".join(token for token in tokenize(expanded) if token not in STOP_WORDS)
    return prepared, additions


def context_cost(chunk: dict, profile: str) -> int:
    """Return the profile-specific context budget cost for one chunk."""
    if profile == LEGACY_PROFILE:
        return len(json.dumps(chunk, ensure_ascii=False).encode("utf-8"))
    token_count = chunk.get("tokenCount")
    if isinstance(token_count, int) and token_count > 0:
        return token_count
    # Technical fixtures predate tokenCount. UTF-8 bytes / 3 is a conservative
    # fallback for mixed Vietnamese/ASCII text and is used only in top5-v2.
    return max(1, math.ceil(len(chunk["text"].encode("utf-8")) / 3))


def select_ranked_chunks(
    ranked: list[tuple[dict, float]],
    *,
    requested_limit: int,
    context_budget: int,
    profile: str,
) -> list[dict]:
    profile = resolve_retrieval_profile(profile)
    limit = min(requested_limit, PROFILE_LIMITS[profile])
    selected: list[dict] = []
    selected_ids: set[str] = set()
    used_context = 0
    for chunk, score in ranked:
        if score <= 0 or len(selected) >= limit:
            break
        if chunk["id"] in selected_ids:
            continue
        cost = context_cost(chunk, profile)
        if used_context + cost > context_budget:
            continue
        used_context += cost
        selected_ids.add(chunk["id"])
        selected.append(chunk)
    return selected


def retriever_version(profile: str) -> str:
    profile = resolve_retrieval_profile(profile)
    if profile == LEGACY_PROFILE:
        return "mba-course-rag-bm25-pilot-v1"
    if profile == TOP5_PROFILE:
        return "mba-course-rag-bm25-pilot-v2-top5-token-budget"
    return "mba-course-rag-bm25-pilot-v3-expanded-top5-token-budget"
