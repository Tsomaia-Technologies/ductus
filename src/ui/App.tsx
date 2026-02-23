import React from 'react'
import { Layout } from './components/Layout'
import { ArchitectView } from './views/ArchitectView'
import { TaskReviewView } from './views/TaskReviewView'
import { EngineerView } from './views/EngineerView'
import { ReviewerView } from './views/ReviewerView'
import { CompleteView } from './views/CompleteView'
import { ErrorView } from './views/ErrorView'
import { useRunContext } from './context/RunContext'

function PhaseRouter() {
  const { phase } = useRunContext()

  switch (phase) {
    case 'architect':
    case 'refinement':
      return <ArchitectView />
    case 'task-review':
      return <TaskReviewView />
    case 'engineer':
    case 'remediation':
      return <EngineerView />
    case 'reviewer':
      return <ReviewerView />
    case 'commit-prompt':
      return null
    case 'complete':
      return <CompleteView />
    case 'error':
      return <ErrorView />
  }
}

export function App() {
  return (
    <Layout>
      <PhaseRouter />
    </Layout>
  )
}
