import {
  PlanID,
  PlanQuestionID,
  PlanRevisionID,
  PlanVerificationID,
  PlanVerificationQuestionID,
  TaskBreakdownID,
  TaskBreakdownQuestionID,
  TaskBreakdownRevisionID,
  TaskID,
  TaskRevisionID,
} from '../types.js'
import { Task } from '../schema/task.js'
import { ImplementationReport } from '../schema/implementation-report.js'
import { DeeplyReadonly } from 'ductus'

export type DuctusState = DeeplyReadonly<{
  plansRevisions: Record<PlanRevisionID, PlanRevisionState>
  taskBreakdownRevisions: Record<TaskBreakdownRevisionID, TaskBreakdownRevisionState>
  taskRevisions: Record<TaskRevisionID, TaskRevisionState>
  planVerifications: Record<PlanVerificationID, PlanVerificationState>

  currentPlanRevisions: Record<PlanID, PlanRevisionID>
  currentTaskBreakdownRevisions: Record<TaskBreakdownID, TaskBreakdownRevisionID>
  currentTaskRevisions: Record<TaskID, TaskRevisionID>
  currentPlanVerifications: Record<TaskID, TaskRevisionID>
}>

export type ArtifactStatus =
  | 'initial'
  | 'pending-user-review'
  | 'pending-agent-review'
  | 'approved'
  | 'rejected'
  | 'completed'

export interface DecisionState<TID = string> {
  questionId: TID
  question: string
  answer: string | null
}

export interface PlanRevisionState {
  id: PlanRevisionID
  planId: string
  planRevisionId: number
  status: ArtifactStatus
  content: string
  decisions: Record<PlanQuestionID, DecisionState<PlanQuestionID>>
  rejectionReason: string | null
}

export interface TaskBreakdownRevisionState {
  id: TaskBreakdownRevisionID
  planId: string
  planRevisionId: number
  breakdownId: TaskBreakdownID
  breakdownRevisionId: number
  status: ArtifactStatus
  tasks: Task[]
  decisions: Record<TaskBreakdownQuestionID, DecisionState<TaskBreakdownQuestionID>>
  rejectionReason: string | null
}

export interface TaskRevisionState {
  id: TaskRevisionID
  planId: string
  planRevisionId: number
  breakdownId: TaskBreakdownID
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
  status: ArtifactStatus
  report: ImplementationReport
  decisions: Record<PlanQuestionID, DecisionState<PlanQuestionID>>
  rejectionReason: string | null
}

export interface PlanVerificationState {
  id: PlanVerificationID
  planId: string
  planRevisionId: number
  breakdownId: TaskBreakdownID
  breakdownRevisionId: number
  status: ArtifactStatus
  decisions: Record<PlanVerificationQuestionID, DecisionState<PlanVerificationQuestionID>>
  rejectionReason: string | null
}
