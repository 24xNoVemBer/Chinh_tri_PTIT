import unittest

from retrieval import (
    LEGACY_PROFILE,
    TOP5_PROFILE,
    context_cost,
    resolve_retrieval_profile,
    retriever_version,
    select_ranked_chunks,
)


def ranked_chunks(count=6, token_count=10):
    return [
        (
            {
                "id": f"chunk-{index}",
                "text": f"retrieval text {index}",
                "tokenCount": token_count,
            },
            float(count - index),
        )
        for index in range(count)
    ]


class RetrievalProfileTests(unittest.TestCase):
    def test_profile_defaults_to_legacy_and_rejects_unknown_values(self):
        self.assertEqual(resolve_retrieval_profile(None), LEGACY_PROFILE)
        with self.assertRaisesRegex(ValueError, "RAG_RETRIEVAL_PROFILE"):
            resolve_retrieval_profile("unknown")

    def test_legacy_profile_preserves_three_chunk_cap(self):
        selected = select_ranked_chunks(
            ranked_chunks(),
            requested_limit=8,
            context_budget=100_000,
            profile=LEGACY_PROFILE,
        )
        self.assertEqual([chunk["id"] for chunk in selected], ["chunk-0", "chunk-1", "chunk-2"])
        self.assertEqual(retriever_version(LEGACY_PROFILE), "mba-course-rag-bm25-pilot-v1")

    def test_top5_profile_uses_five_chunk_cap(self):
        selected = select_ranked_chunks(
            ranked_chunks(),
            requested_limit=8,
            context_budget=100_000,
            profile=TOP5_PROFILE,
        )
        self.assertEqual(len(selected), 5)
        self.assertIn("top5-token-budget", retriever_version(TOP5_PROFILE))

    def test_request_limit_remains_authoritative(self):
        selected = select_ranked_chunks(
            ranked_chunks(),
            requested_limit=2,
            context_budget=100_000,
            profile=TOP5_PROFILE,
        )
        self.assertEqual(len(selected), 2)

    def test_top5_profile_enforces_token_budget(self):
        selected = select_ranked_chunks(
            ranked_chunks(token_count=10),
            requested_limit=8,
            context_budget=25,
            profile=TOP5_PROFILE,
        )
        self.assertEqual([chunk["id"] for chunk in selected], ["chunk-0", "chunk-1"])

    def test_selection_deduplicates_chunk_ids(self):
        ranked = ranked_chunks()
        ranked.insert(1, ranked[0])
        selected = select_ranked_chunks(
            ranked,
            requested_limit=8,
            context_budget=100_000,
            profile=TOP5_PROFILE,
        )
        self.assertEqual(len(selected), 5)
        self.assertEqual(len({chunk["id"] for chunk in selected}), 5)

    def test_top5_fixture_fallback_is_token_shaped_not_legacy_bytes(self):
        chunk = {"id": "fixture", "text": "abc" * 20}
        self.assertGreater(context_cost(chunk, TOP5_PROFILE), 0)
        self.assertNotEqual(context_cost(chunk, TOP5_PROFILE), context_cost(chunk, LEGACY_PROFILE))


if __name__ == "__main__":
    unittest.main()
