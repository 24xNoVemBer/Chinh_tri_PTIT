import {
  apiAuditRepository,
  apiChatRepository,
  apiClassContentRepository,
  apiClassRepository,
  apiLearningRepository,
  apiPracticeQuestionRepository,
  apiPracticeSessionRepository,
  apiQuestionRepository,
  apiSearchRepository,
  apiSubjectRepository,
} from './api/repositories'
import { classContentRepository as mockClassContentRepository } from './repositories/classContentRepository'
import { classRepository as mockClassRepository } from './repositories/classRepository'
import { learningRepository as mockLearningRepository } from './repositories/learningRepository'
import { questionRepository as mockQuestionRepository } from './repositories/questionRepository'
import { searchRepository as mockSearchRepository } from './repositories/searchRepository'
import { subjectRepository as mockSubjectRepository } from './repositories/subjectRepository'

const useMockData = import.meta.env.MODE === 'test' || import.meta.env.VITE_DATA_SOURCE === 'mock'

export const classRepository = useMockData ? mockClassRepository : apiClassRepository
export const classContentRepository = useMockData
  ? mockClassContentRepository
  : apiClassContentRepository
export const learningRepository = useMockData ? mockLearningRepository : apiLearningRepository
export const practiceQuestionRepository = apiPracticeQuestionRepository
export const practiceSessionRepository = apiPracticeSessionRepository
export const questionRepository = useMockData ? mockQuestionRepository : apiQuestionRepository
export const searchRepository = useMockData ? mockSearchRepository : apiSearchRepository
export const subjectRepository = useMockData ? mockSubjectRepository : apiSubjectRepository
export const auditRepository = apiAuditRepository
export const chatRepository = apiChatRepository
