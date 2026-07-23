import React from 'react'
import { useParams } from 'react-router-dom'

export default function QuizPage() {
  const { quizId } = useParams()

  return (
    <div>
      <h1>Làm bài Quiz</h1>
      <p>Quiz ID: {quizId}</p>
      <p>Giao diện làm bài kiểm tra trắc nghiệm.</p>
    </div>
  )
}
