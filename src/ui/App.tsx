import React from 'react'
import { Layout } from './components/Layout.js'
import { ArchitectView } from './views/ArchitectView.js'
import { TaskReviewView } from './views/TaskReviewView.js'
import { EngineerView } from './views/EngineerView.js'
import { ReviewerView } from './views/ReviewerView.js'
import { CompleteView } from './views/CompleteView.js'
import { ErrorView } from './views/ErrorView.js'
import { useRunContext } from './context/RunContext.js'

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
