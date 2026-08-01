import { randomUUID } from 'node:crypto'

export const RAG_SCENARIOS = Object.freeze([
  'answered-single-citation',
  'answered-multiple-citations',
  'abstained-no-source',
  'blocked-safety',
  'slow-success',
  'rate-limited',
  'provider-unavailable',
  'provider-timeout',
  'invalid-citation',
  'malformed-response',
  'stream-disconnect',
  'duplicate-success',
  'out-of-order-event',
])

const baseCitation = (
  version = 'material-version-triet-hoc-2026',
  rank = 1,
  materialId = 'material-triet-hoc',
) => ({
  materialId,
  materialVersionId: version,
  chunkId: `chunk-000${rank}`,
  page: 12 + rank,
  section: 'Vật chất và ý thức',
  quote:
    rank === 1
      ? 'Vật chất là thực tại khách quan được đem lại cho con người trong cảm giác.'
      : 'Ý thức là sự phản ánh hiện thực khách quan vào bộ óc người.',
  rank,
  retrievalScore: 0.94 - rank / 100,
  rerankScore: 0.91 - rank / 100,
  chunkSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
})

export function createTerminalAnswer(request, scenario = 'answered-single-citation') {
  const now = Date.now()
  const version = request.scope.allowedMaterialVersionIds[0] ?? 'material-version-triet-hoc-2026'
  const materialId =
    { mv1: 'mat1', mv2: 'mat2', mv3: 'mat3', mv4: 'mat4', mv5: 'mat5', mv6: 'mat6' }[version] ??
    (version === 'material-version-triet-hoc-2026' ? 'material-triet-hoc' : 'mock-material')
  const citations =
    scenario === 'answered-multiple-citations'
      ? [baseCitation(version, 1, materialId), baseCitation(version, 2, materialId)]
      : [baseCitation(version, 1, materialId)]
  const answer = {
    schemaVersion: '1.0',
    requestId: request.requestId,
    providerJobId: `rag-${randomUUID()}`,
    outcome: 'answered',
    answer: {
      text: 'Vật chất là thực tại khách quan; ý thức là sự phản ánh hiện thực khách quan vào bộ óc người trong hoạt động xã hội.',
      language: 'vi-VN',
      finishReason: 'stop',
    },
    citations,
    safety: { decision: 'allow', policyVersion: request.policy.safetyPolicyVersion },
    review: { required: false, status: 'not_required' },
    provenance: {
      provider: 'ptit-rag-mock',
      model: 'mock-grounded-model',
      modelRevision: 'mock-1',
      promptVersion: 'answer-grounded-v1',
      embeddingVersion: 'embed-mock-1',
      retrieverVersion: 'retrieve-mock-1',
      rerankerVersion: 'rerank-mock-1',
      indexVersion: 'index-mock-1',
    },
    usage: { inputTokens: 120, outputTokens: 42, retrievedChunks: citations.length },
    timing: {
      queueMs: 5,
      retrievalMs: 20,
      firstTokenMs: 50,
      generationMs: 80,
      totalMs: Math.max(1, Date.now() - now) + 105,
    },
  }
  if (scenario === 'abstained-no-source') {
    answer.outcome = 'abstained'
    answer.answer = {
      text: 'Chưa tìm thấy học liệu được phê duyệt để trả lời chắc chắn câu hỏi này.',
      language: 'vi-VN',
      finishReason: 'no_source',
    }
    answer.citations = []
  }
  if (scenario === 'blocked-safety') {
    answer.outcome = 'blocked'
    answer.answer = { text: '', language: 'vi-VN', finishReason: 'safety' }
    answer.citations = []
    answer.safety = {
      decision: 'block',
      category: 'unsafe_request',
      reason: 'Nội dung bị chặn bởi chính sách an toàn.',
      policyVersion: request.policy.safetyPolicyVersion,
    }
    answer.review = {
      required: true,
      status: 'pending',
      priority: 'high',
      reasonCodes: ['SAFETY_BLOCK'],
    }
  }
  if (scenario === 'invalid-citation') answer.citations[0].materialVersionId = 'unapproved-version'
  if (scenario === 'malformed-response') delete answer.provenance.indexVersion
  return answer
}

export function errorForScenario(scenario, requestId) {
  const common = { requestId, retryable: true }
  const errors = {
    'rate-limited': { code: 'RATE_LIMITED', message: 'Mock rate limit exceeded.' },
    'provider-unavailable': { code: 'PROVIDER_UNAVAILABLE', message: 'Mock provider unavailable.' },
    'provider-timeout': { code: 'PROVIDER_TIMEOUT', message: 'Mock provider timed out.' },
  }
  return {
    ...common,
    ...(errors[scenario] ?? { code: 'INTERNAL', message: 'Mock internal error.' }),
  }
}
