import { pathToFileURL } from 'node:url'

export const EVALUATION_CASES = {
  BAS1150: {
    course: 'Triết học Mác - Lênin',
    question: 'Trình bày định nghĩa vật chất của V.I. Lênin theo giáo trình.',
    expectedChecks: [
      'Vật chất là một phạm trù triết học chỉ thực tại khách quan.',
      'Thực tại khách quan được đem lại trong cảm giác và được cảm giác phản ánh.',
      'Vật chất tồn tại không lệ thuộc vào cảm giác.',
    ],
  },
  BAS1151: {
    course: 'Kinh tế chính trị Mác - Lênin',
    question: 'Theo giáo trình, hàng hóa có những thuộc tính cơ bản nào?',
    expectedChecks: [
      'Nêu giá trị sử dụng và giải thích công dụng/khả năng thỏa mãn nhu cầu.',
      'Nêu giá trị và giải thích lao động xã hội kết tinh trong hàng hóa.',
      'Nguồn trả về phải hỗ trợ trực tiếp cả hai thuộc tính.',
    ],
  },
  BAS1152: {
    course: 'Chủ nghĩa xã hội khoa học',
    question: 'Theo giáo trình, sứ mệnh lịch sử của giai cấp công nhân là gì?',
    expectedChecks: [
      'Nêu nội dung tổng quát của sứ mệnh lịch sử.',
      'Nêu vai trò tổ chức/lãnh đạo và mục tiêu giải phóng, cải biến xã hội theo nguồn.',
      'Đoạn trích phải trực tiếp hỗ trợ các ý chính.',
    ],
  },
  BAS1153: {
    course: 'Lịch sử Đảng Cộng sản Việt Nam',
    question:
      'Đại hội XIII xác định mục tiêu phát triển đất nước đến năm 2030 và tầm nhìn đến năm 2045 như thế nào?',
    expectedChecks: [
      'Đến năm 2030: nước đang phát triển, có công nghiệp hiện đại, thu nhập trung bình cao.',
      'Đến năm 2045: nước phát triển, thu nhập cao.',
      'Không nhầm với mục tiêu của Đại hội XI hoặc mốc thời gian khác.',
    ],
  },
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function validateApiBase(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('MBA_CHAT_EVAL_API_URL phải là URL hợp lệ.')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('MBA_API chỉ được gọi qua HTTP(S).')
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('Chỉ cho phép URL loopback; mở SSH tunnel nếu MBA_API ở máy chủ.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('URL không được chứa thông tin đăng nhập, query hoặc fragment.')
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, '')}/`
  return url
}

export function extractChatResult(payload) {
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  const answerPayload = root?.text ?? root?.answer ?? root
  const answer =
    typeof answerPayload === 'string'
      ? answerPayload
      : (answerPayload?.response ?? answerPayload?.answer ?? '')
  const sources = Array.isArray(answerPayload?.sources)
    ? answerPayload.sources
    : Array.isArray(root?.sources)
      ? root.sources
      : Array.isArray(payload?.sources)
        ? payload.sources
        : []

  return {
    status: root?.status ?? payload?.status ?? null,
    answer: String(answer ?? ''),
    sources: sources.map((source) => ({
      fileName: source?.file_name ?? source?.filename ?? source?.title ?? null,
      score: source?.score ?? null,
      text: String(source?.text ?? source?.quote ?? ''),
    })),
  }
}

function parseArgs(args) {
  const options = { run: false, confirmation: false, help: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--run') options.run = true
    else if (arg === '--confirm-chat-request') options.confirmation = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--source' || arg === '--api') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${arg} cần một giá trị.`)
      options[arg === '--source' ? 'source' : 'api'] = value
      index += 1
    } else {
      throw new Error(`Tham số không được hỗ trợ: ${arg}`)
    }
  }
  return options
}

function printHelp() {
  console.log(`Dùng:
  npm run mba:chat:eval -- --source BAS1151
  npm run mba:chat:eval -- --source BAS1151 --run --confirm-chat-request

Mặc định chỉ in dry-run. Chạy thật gửi đúng một request tới POST /chat,
có thể tiêu thụ quota model và MBA_API có thể vẫn lưu hội thoại dù save=false.
URL mặc định: http://127.0.0.1:4558 (chỉ loopback; dùng SSH tunnel nếu cần).`)
}

export async function runCli(args, env = process.env, fetchImpl = fetch) {
  const options = parseArgs(args)
  if (options.help) {
    printHelp()
    return 0
  }
  if (!options.source || !Object.hasOwn(EVALUATION_CASES, options.source)) {
    throw new Error(`Chọn đúng một source trong: ${Object.keys(EVALUATION_CASES).join(', ')}.`)
  }
  if (options.confirmation && !options.run) {
    throw new Error('--confirm-chat-request chỉ hợp lệ khi có --run.')
  }
  if (options.run && !options.confirmation) {
    throw new Error('Request thật cần cả --run và --confirm-chat-request.')
  }

  const base = validateApiBase(options.api ?? env.MBA_CHAT_EVAL_API_URL ?? 'http://127.0.0.1:4558')
  const testCase = EVALUATION_CASES[options.source]
  const requestBody = {
    userId: 'ptit:acceptance-eval',
    text: testCase.question,
    source: options.source,
    save: false,
    mode: 'default',
    metadata: { subject_name: testCase.course },
  }

  if (!options.run) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          api: new URL('chat', base).toString(),
          source: options.source,
          course: testCase.course,
          question: testCase.question,
          expectedChecks: testCase.expectedChecks,
          request: requestBody,
          note: 'No network request was made. Review the case before opting in to a live request.',
        },
        null,
        2,
      ),
    )
    return 0
  }

  const response = await fetchImpl(new URL('chat', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`MBA_API trả HTTP ${response.status}: ${detail}`)
  }

  const payload = await response.json()
  console.log(
    JSON.stringify(
      {
        mode: 'result',
        source: options.source,
        course: testCase.course,
        question: testCase.question,
        expectedChecks: testCase.expectedChecks,
        ...extractChatResult(payload),
        manualReviewRequired: true,
      },
      null,
      2,
    ),
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      console.error(`MBA chat evaluation stopped: ${error.message}`)
      process.exitCode = 1
    })
}
