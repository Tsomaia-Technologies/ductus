import React, { createContext, useContext, useState, useCallback } from 'react'
import type { RunPhase, ErrorContext } from '../../pipeline/context.js'
import type { Task } from '../../schema.js'
import type { InkTapsRef } from '../../pipeline/taps/ink-taps.js'

export interface RunState {
  phase: RunPhase
  feature: string
  tasks: Task[]
  currentTaskIndex: number
  currentTaskId: string | null
  currentAttempt: number
  maxRetries: number
  streamContent: string
  streamActive: boolean
  error: string | null
  errorContext: ErrorContext | null
}

interface RunContextValue extends RunState {
  setPhase: (phase: RunPhase) => void
  appendStream: (chunk: string) => void
  setStreamActive: (active: boolean) => void
  setError: (err: string | null, context?: ErrorContext) => void
  setTasks: (tasks: Task[]) => void
  setCurrentTask: (index: number, taskId: string | null) => void
  setCurrentAttempt: (n: number) => void
  submitTaskApproval: (feedback: string | null) => void
}

const RunContext = createContext<RunContextValue | null>(null)

interface RunProviderProps {
  feature: string
  maxRetries: number
  /** Mutable ref for taps to store task approval resolver; RunContextValue extends InkTapsRef.current */
  tapsRef: InkTapsRef
  children: React.ReactNode
}

export function RunProvider({ feature, maxRetries, tapsRef, children }: RunProviderProps) {
  const [phase, setPhaseState] = useState<RunPhase>('architect')
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [currentAttempt, setCurrentAttempt] = useState(0)
  const [streamContent, setStreamContent] = useState('')
  const [streamActive, setStreamActiveState] = useState(false)
  const [error, setErrorState] = useState<string | null>(null)
  const [errorContext, setErrorContextState] = useState<ErrorContext | null>(null)

  const setPhase = useCallback((p: RunPhase) => setPhaseState(p), [])
  const setStreamActive = useCallback((active: boolean) => setStreamActiveState(active), [])
  const setError = useCallback((err: string | null, context?: ErrorContext) => {
    setErrorState(err)
    setErrorContextState(context ?? null)
  }, [])

  const appendStream = useCallback((chunk: string) => {
    setStreamContent((prev) => prev + chunk)
  }, [])

  const setCurrentTask = useCallback((index: number, taskId: string | null) => {
    setCurrentTaskIndex(index)
    setCurrentTaskId(taskId)
  }, [])

  const submitTaskApproval = useCallback((feedback: string | null) => {
    const cur = tapsRef.current
    cur?._taskApprovalResolve?.(feedback)
    if (cur && '_taskApprovalResolve' in cur) delete cur._taskApprovalResolve
  }, [tapsRef])

  const value: RunContextValue = {
    phase,
    feature,
    tasks,
    currentTaskIndex,
    currentTaskId,
    currentAttempt,
    maxRetries,
    streamContent,
    streamActive,
    error,
    errorContext,
    setPhase,
    appendStream,
    setStreamActive,
    setError,
    setTasks,
    setCurrentTask,
    setCurrentAttempt,
    submitTaskApproval,
  }

  tapsRef.current = value as RunContextValue & { _taskApprovalResolve?: (f: string | null) => void }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

export function useRunContext(): RunContextValue {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error('useRunContext must be used within RunProvider')
  return ctx
}
