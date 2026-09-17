"""Shared lexical retrieval policies for the local RAG pilot."""

from __future__ import annotations

import json
import math


LEGACY_PROFILE = "legacy-v1"
TOP5_PROFILE = "top5-v2"
RETRIEVAL_PROFILES = {LEGACY_PROFILE, TOP5_PROFILE}
PROFILE_LIMITS = {LEGACY_PROFILE: 3, TOP5_PROFILE: 5}


def resolve_retrieval_profile(value: str | None) -> str:
    profile = str(value or LEGACY_PROFILE).strip().lower()
    if profile not in RETRIEVAL_PROFILES:
        raise ValueError("RAG_RETRIEVAL_PROFILE must be legacy-v1 or top5-v2")
    return profile


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
    return "mba-course-rag-bm25-pilot-v2-top5-token-budget"
