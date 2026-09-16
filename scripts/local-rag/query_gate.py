"""Deterministic scope and prompt-injection gate for the private philosophy pilot."""

from __future__ import annotations

import re
import unicodedata


GATE_VERSION = "triet-hoc-domain-gate-v1"

INJECTION_PATTERNS = [
    re.compile(r"\bbỏ qua\b.{0,80}\b(quy tắc|chỉ dẫn|hướng dẫn|câu hỏi)\b"),
    re.compile(r"\b(system prompt|api key|biến môi trường)\b"),
    re.compile(r"\b(mật khẩu|password)\b.{0,80}\b(hệ thống|quản trị|máy chủ|server)\b"),
    re.compile(r"\b(xóa|xoá)\b.{0,40}\b(dữ liệu|database|tệp|file)\b"),
    re.compile(r"\b(làm theo|thực hiện)\b.{0,50}\bchỉ dẫn\b.{0,50}\b(tài liệu|nguồn)\b"),
]

DOMAIN_PATTERNS = [
    re.compile(pattern)
    for pattern in [
        r"\btriết học\b",
        r"\bvật chất\b",
        r"\bý thức\b",
        r"\bbiện chứng\b",
        r"\bsiêu hình\b",
        r"\bmối liên hệ\b",
        r"\bnguyên lý\b.{0,40}\bphát triển\b",
        r"\blượng\b.{0,80}\bchất\b|\bchất\b.{0,80}\blượng\b",
        r"\bđiểm nút\b|\bbước nhảy\b",
        r"\bmặt đối lập\b|\bmâu thuẫn\b",
        r"\bphủ định\b",
        r"\bthực tiễn\b",
        r"\bnhận thức\b",
        r"\bchân lý\b",
        r"\bsản xuất vật chất\b",
        r"\blực lượng sản xuất\b",
        r"\bquan hệ sản xuất\b",
        r"\bphương thức sản xuất\b",
        r"\bcơ sở hạ tầng\b",
        r"\bkiến trúc thượng tầng\b",
        r"\btồn tại xã hội\b",
        r"\bý thức xã hội\b",
        r"\bquần chúng nhân dân\b",
        r"\blịch sử xã hội\b",
        r"\bphương pháp luận\b",
        r"\bsự vật\b.{0,60}\b(vận động|biến đổi)\b",
        r"\bcái mới\b.{0,60}\bcái cũ\b",
        r"\btồn tại\b.{0,80}\bkhông phụ thuộc\b",
        r"\bngười lao động\b|\btư liệu sản xuất\b",
        r"\btổ chức sản xuất\b.{0,100}\b(công cụ|lao động|trình độ)\b",
        r"\bnền tảng kinh tế\b.{0,100}\b(nhà nước|pháp luật|chính trị)\b",
        r"\btư tưởng xã hội\b.{0,100}\b(sinh hoạt vật chất|điều kiện vật chất)\b",
    ]
]


def normalize_query(value: str) -> str:
    value = unicodedata.normalize("NFC", value).casefold()
    return re.sub(r"\s+", " ", value).strip()


def evaluate_query(query: str) -> dict:
    normalized = normalize_query(query)
    if any(pattern.search(normalized) for pattern in INJECTION_PATTERNS):
        return {"allowed": False, "reason": "prompt_injection", "version": GATE_VERSION}
    if any(pattern.search(normalized) for pattern in DOMAIN_PATTERNS):
        return {"allowed": True, "reason": "domain_match", "version": GATE_VERSION}
    return {"allowed": False, "reason": "out_of_scope", "version": GATE_VERSION}
