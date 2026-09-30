import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const COURSES = [
  {
    subjectId: 'sub1',
    courseCode: 'BAS1150',
    name: 'Triết học Mác - Lênin',
    folder: 'Triết học',
    primaryPrefix: '20260729_075440_',
  },
  {
    subjectId: 'sub2',
    courseCode: 'BAS1151',
    name: 'Kinh tế chính trị Mác - Lênin',
    folder: 'Kinh tế chính trị',
    primaryPrefix: '20260727_045942_',
  },
  {
    subjectId: 'sub3',
    courseCode: 'BAS1152',
    name: 'Chủ nghĩa xã hội khoa học',
    folder: 'Chủ nghĩa xã hội',
    primaryPrefix: '20260730_013242_',
  },
  {
    subjectId: 'sub4',
    courseCode: 'BAS1122',
    name: 'Tư tưởng Hồ Chí Minh',
    folder: 'Tư tưởng hồ chí minh',
    primaryPrefix: '20260718_105355_',
  },
  {
    subjectId: 'sub5',
    courseCode: 'BAS1153',
    name: 'Lịch sử Đảng Cộng sản Việt Nam',
    folder: 'Lịch sử đảng',
    primaryPrefix: '20260724_032101_',
  },
]

function normalize(value) {
  return value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/gu, ' ').trim()
}

async function inspectPdf(path, includeHash = false) {
  const fileStat = await stat(path)
  const handle = await open(path, 'r')
  const header = Buffer.alloc(5)
  try {
    await handle.read(header, 0, header.length, 0)
  } finally {
    await handle.close()
  }
  const validPdf = fileStat.isFile() && fileStat.size >= 1024 && header.toString() === '%PDF-'
  const result = { bytes: fileStat.size, validPdf }
  if (validPdf && includeHash) {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk)
    result.sha256 = hash.digest('hex')
  }
  return result
}

async function audit(root) {
  const folders = (await readdir(root, { withFileTypes: true })).filter((entry) =>
    entry.isDirectory(),
  )
  const courses = []
  for (const course of COURSES) {
    const folderMatches = folders.filter(
      (entry) => normalize(entry.name) === normalize(course.folder),
    )
    const item = {
      subjectId: course.subjectId,
      courseCode: course.courseCode,
      name: course.name,
      targetSourceId: course.courseCode,
      primary: null,
      otherDocuments: [],
      ready: false,
    }
    if (folderMatches.length !== 1) {
      item.error = `Expected one folder for ${course.folder}; found ${folderMatches.length}.`
      courses.push(item)
      continue
    }
    const folder = folderMatches[0].name
    const files = (await readdir(join(root, folder), { withFileTypes: true })).filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'),
    )
    const primaries = files.filter((entry) => entry.name.startsWith(course.primaryPrefix))
    if (primaries.length !== 1) {
      item.error = `Expected one primary PDF with prefix ${course.primaryPrefix}; found ${primaries.length}.`
    }
    for (const file of files) {
      const relativePath = join(folder, file.name)
      const isPrimary = primaries.length === 1 && file.name === primaries[0].name
      const details = await inspectPdf(join(root, relativePath), isPrimary)
      const record = { path: relativePath, ...details }
      if (isPrimary) {
        item.primary = record
        item.ready = details.validPdf
      } else {
        item.otherDocuments.push(record)
      }
    }
    courses.push(item)
  }
  const invalidExtras = courses.flatMap((course) =>
    course.otherDocuments.filter((document) => !document.validPdf).map((document) => document.path),
  )
  return {
    result: courses.every((course) => course.ready) ? 'PASS' : 'FAIL',
    readyForUpload: courses.every((course) => course.ready),
    targetSourceMap: Object.fromEntries(
      courses.map((course) => [course.subjectId, course.courseCode]),
    ),
    courses,
    warnings: invalidExtras.map((path) => `${path} is not a usable PDF.`),
  }
}

const rootArgument = process.argv.indexOf('--root')
if (rootArgument < 0 || !process.argv[rootArgument + 1]) {
  console.error('Usage: npm run mba:corpus:audit -- --root <path-to-Backup_GT_CHINH_TRI>')
  process.exitCode = 2
} else {
  try {
    const report = await audit(process.argv[rootArgument + 1])
    console.log(JSON.stringify(report, null, 2))
    if (!report.readyForUpload) process.exitCode = 1
  } catch (error) {
    console.error(`Corpus audit failed: ${error.message}`)
    process.exitCode = 1
  }
}
