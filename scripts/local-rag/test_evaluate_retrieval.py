import unittest

from evaluate_retrieval import evaluate_cases, validate_eval


class RetrievalEvaluationTests(unittest.TestCase):
    def test_retrieval_coverage_and_abstention_are_reported_without_text(self):
        chunks = [
            {"text": "Vật chất là thực tại khách quan.", "pdfPageStart": 2},
            {"text": "Ý thức tác động trở lại vật chất.", "pdfPageStart": 3},
        ]
        cases = [
            {
                "id": "retrieve-1",
                "category": "direct",
                "question": "vật chất ý thức",
                "expectedBehavior": "retrieve",
                "expectedTermGroups": [["thực tại khách quan"], ["tác động trở lại"]],
            },
            {
                "id": "abstain-1",
                "category": "out_of_scope",
                "question": "thời tiết",
                "expectedBehavior": "abstain",
                "expectedTermGroups": [],
            },
        ]

        def scores(query, _texts):
            return [1.0, 0.8] if "vật chất" in query else [0.0, 0.0]

        report = evaluate_cases(chunks, cases, score_fn=scores)
        self.assertEqual(report["summary"]["passed"], 2)
        self.assertFalse(any("text" in result for result in report["cases"]))
        self.assertEqual(report["cases"][0]["topPages"], [2, 3])
        self.assertEqual(
            report["summary"]["thresholdAnalysis"]["bestBalancedObserved"]["balancedScore"],
            1.0,
        )

        gated = evaluate_cases(
            chunks,
            cases,
            score_fn=scores,
            gate_fn=lambda question: {
                "allowed": "thời tiết" not in question,
                "reason": "test",
                "version": "test-gate",
            },
        )
        self.assertEqual(gated["summary"]["gateAnalysis"]["abstainRejected"], 1)

    def test_eval_validation_rejects_duplicate_ids(self):
        case = {
            "id": "same",
            "category": "direct",
            "question": "Vật chất là gì?",
            "expectedBehavior": "retrieve",
            "expectedTermGroups": [["vật chất"]],
        }
        payload = {
            "schemaVersion": "retrieval-eval-1",
            "datasetId": "private-test",
            "status": "draft_unreviewed",
            "language": "vi-VN",
            "description": "test",
            "cases": [case, case],
        }
        with self.assertRaisesRegex(ValueError, "unique"):
            validate_eval(payload, "private-test")


if __name__ == "__main__":
    unittest.main()
