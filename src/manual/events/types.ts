import { BaseEvent } from '../interfaces/event.js'
import { Task } from '../schema/task.js'
import { ImplementationReport } from '../schema/implementation-report.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'

export type FeatureRequestEvent = BaseEvent<'feature-request', {
  description: string
}>

export type PlanQuestionEvent = BaseEvent<'plan-question', {
  planId: string
  questionId: number
  question: string
}>

export type PlanAnswer = BaseEvent<'plan-answer', {
  planId: string
  questionId: number
  answer: string
}>

export interface Decision {
  question: string
  answer: string
}

// full plan context, including all questions and answers (decisions), is saved in memory,
// audit concerns, etc
export type PlanProposalEvent = BaseEvent<'plan-proposal', {
  planId: string
  planRevisionId: number
  content: string
}>

export type PlanConcernEvent = BaseEvent<'plan-concern', {
  planId: string
  planRevisionId: number
  concernId: number
  concern: string
}>

export type PlanConcernResolutionEvent = BaseEvent<'plan-concern-resolution', {
  planId: string
  planRevisionId: number
  concernId: number
  resolution: string
}>

export type PlanUserApprovalEvent = BaseEvent<'plan-user-approval', {
  planId: string
  planRevisionId: number
  comment?: string
}>

export type PlanUserRejectionEvent = BaseEvent<'plan-user-rejection', {
  planId: string
  planRevisionId: number
  rejectionId: number
  reason: string
}>

export type TaskBreakdownRequestEvent = BaseEvent<'task-breakdown-request', {
  planId: string
  planRevisionId: number
}>

export type TaskBreakdownQuestionEvent = BaseEvent<'task-breakdown-question', {
  planId: string
  planRevisionId: number
  questionId: number
  question: string
}>

export type TaskBreakdownAnswerEvent = BaseEvent<'task-breakdown-answer', {
  planId: string
  planRevisionId: number
  questionId: number
  answer: string
}>

export type TaskBreakdownProposalEvent = BaseEvent<'task-breakdown-proposal', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  tasks: Task[]
}>

export type TaskBreakdownConcernEvent = BaseEvent<'task-breakdown-concern', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  concernId: number
  concern: string
}>

export type TaskBreakdownConcernResolutionEvent = BaseEvent<'task-breakdown-concern-resolution', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  resolution: string
}>

export type TaskBreakdownUserApprovalEvent = BaseEvent<'task-breakdown-user-approval', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  comment?: string
}>

export type TaskBreakdownUserRejectionEvent = BaseEvent<'task-breakdown-user-rejection', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  rejectionId: number
  reason: string
}>

export type TaskStartEvent = BaseEvent<'task-start', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  taskId: number
}>

export type TaskImplementationReportEvent = BaseEvent<'task-implementation-report', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  taskId: number
  taskRevisionId: number
  report: ImplementationReport
}>

export type TaskUserReviewRequest = BaseEvent<'task-user-review-request', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  taskId: number
  taskRevisionId: number
  taskReviewId: number
}>

export type TaskUserApproval = BaseEvent<'task-user-approval', {
  planId: string
  planRevisionId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
  reportId: number
  reviewId: number
  comment?: string
}>

export type TaskUserRejection = BaseEvent<'task-user-rejection', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  taskId: number
  taskRevisionId: number
  taskReviewId: number
  reason: string
}>

export type TaskReviewerApproval = BaseEvent<'task-agent-approval', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  taskId: number
  taskRevisionId: number
  taskReviewId: number
  comment?: string
}>

export type TaskReviewerRejection = BaseEvent<'task-agent-rejection', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  taskId: number
  taskRevisionId: number
  taskReviewId: number
  reason: string
}>

export type TaskCompletedEvent = BaseEvent<'task-agent-completed', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  taskId: number
  taskRevisionId: number
}>

export type FeatureUserReviewRequest = BaseEvent<'feature-user-review-request', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  featureReviewId: number
}>

export type FeatureUserApproval = BaseEvent<'feature-user-review-approval', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  featureReviewId: number
  comment?: string
}>

export type FeatureUserRejection = BaseEvent<'feature-user-rejection', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  featureReviewId: number
  reason: string
}>

export type FeatureAgentApproval = BaseEvent<'feature-agent-review-request', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  featureReviewId: number
  comment?: string
}>

export type FeatureAgentRejection = BaseEvent<'feature-agent-rejection', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
  featureReviewId: number
  reason: string
}>

export type FeatureCompletedEvent = BaseEvent<'feature-agent-completed', {
  planId: string
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  featureId: number
  featureRevisionId: number
}>

export type AgentStartedReasoningEvent = BaseEvent<'agent-started-reasoning', {
  agentId: string
  responseId: string
}>

export type AgentCompletedReasoningEvent = BaseEvent<'agent-completed-reasoning', {
  agentId: string
  responseId: string
}>

export type AgentStartedResponseEvent = BaseEvent<'agent-started-response', {
  agentId: string
  responseId: string
}>

export type AgentResponseChunkEvent = BaseEvent<'agent-response-chunk', {
  agentId: string
  responseId: string
  chunk: AgentChunk
}>

export type AgentCompletedResponseEvent = BaseEvent<'agent-completed-response', {
  agentId: string
  responseId: string
}>
