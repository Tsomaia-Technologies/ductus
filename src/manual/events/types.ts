import { BaseEvent } from '../interfaces/event.js'
import { Task } from '../schema/task.js'
import { ImplementationReport } from '../schema/implementation-report.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'

export type PlanID = `plan-${string}`
export type PlanRevisionID = `${PlanID}-revision-${number}`
export type PlanQuestionID = `${PlanRevisionID}-question-${number}`
export type TaskBreakdownID = `${PlanRevisionID}-breakdown-${number}`
export type TaskBreakdownRevisionID = `${TaskBreakdownID}-revision-${number}`
export type TaskBreakdownQuestionID = `${TaskBreakdownRevisionID}-question-${number}`
export type TaskID = `${TaskBreakdownRevisionID}-task-${number}`
export type TaskRevisionID = `${TaskID}-revision-${number}`
export type TaskQuestionID = `${TaskRevisionID}-question-${number}`
export type PlanVerificationID = `${PlanRevisionID}-verification-${number}`
export type PlanVerificationQuestionID = `${PlanVerificationID}-question-${number}`

export type TerminateProcessorEvent = BaseEvent<'terminate-processor', void>

export type FeatureRequestEvent = BaseEvent<'feature-request', {
  description: string
}>

export type PlanCreatedEvent = BaseEvent<'plan-created', {
  planRevisionId: PlanRevisionID
}>

export type PlanQuestionEvent = BaseEvent<'plan-question', {
  questionId: PlanQuestionID
  question: string
}>

export type PlanAnswer = BaseEvent<'plan-answer', {
  questionId: PlanQuestionID
  answer: string
}>

export interface Decision {
  question: string
  answer: string
}

// full plan context, including all questions and answers (decisions), is saved in memory,
// audit concerns, etc
export type PlanProposalEvent = BaseEvent<'plan-proposal', {
  planId: PlanID
  planRevisionId: number
  content: string
}>

export type PlanUserReviewRequestEvent = BaseEvent<'plan-user-review-request', {
  planId: PlanID
  planRevisionId: number
}>

export type PlanUserApprovalEvent = BaseEvent<'plan-user-approval', {
  planId: PlanID
  planRevisionId: number
}>

export type PlanUserRejectionEvent = BaseEvent<'plan-user-rejection', {
  planId: PlanID
  planRevisionId: number
  reason: string
}>

export type PlanAgentReviewRequestEvent = BaseEvent<'plan-agent-review-request', {
  planId: PlanID
  planRevisionId: number
}>

export type PlanAgentReviewQuestionEvent = BaseEvent<'plan-agent-review-question', {
  planId: PlanID
  planRevisionId: number
  questionId: number
  question: string
}>

export type PlanAgentReviewAnswerEvent = BaseEvent<'plan-agent-review-answer', {
  planId: PlanID
  planRevisionId: number
  questionId: number
  answer: string
}>

export type PlanAgentApprovalEvent = BaseEvent<'plan-agent-approval', {
  planId: PlanID
  planRevisionId: number
}>

export type PlanAgentRejectionEvent = BaseEvent<'plan-agent-rejection', {
  planId: PlanID
  planRevisionId: number
  reason: string
}>

export type TaskBreakdownRequestEvent = BaseEvent<'task-breakdown-request', {
  planId: PlanID
  planRevisionId: number
}>

export type TaskBreakdownQuestionEvent = BaseEvent<'task-breakdown-question', {
  planId: PlanID
  planRevisionId: number
  questionId: number
  question: string
}>

export type TaskBreakdownAnswerEvent = BaseEvent<'task-breakdown-answer', {
  planId: PlanID
  planRevisionId: number
  questionId: number
  answer: string
}>

export type TaskBreakdownProposalEvent = BaseEvent<'task-breakdown-proposal', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  tasks: Task[]
}>

export type TaskBreakdownUserReviewRequestEvent = BaseEvent<'task-breakdown-user-review-request', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
}>

export type TaskBreakdownUserApprovalEvent = BaseEvent<'task-breakdown-user-approval', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
}>

export type TaskBreakdownUserRejectionEvent = BaseEvent<'task-breakdown-user-rejection', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  reason: string
}>

export type TaskBreakdownAgentReviewRequestEvent = BaseEvent<'task-breakdown-agent-review-request', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
}>

export type TaskBreakdownAgentReviewQuestionEvent = BaseEvent<'task-breakdown-agent-review-question', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  questionId: number
  question: string
}>

export type TaskBreakdownAgentReviewAnswerEvent = BaseEvent<'task-breakdown-agent-review-answer', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  questionId: number
  answer: string
}>

export type TaskBreakdownAgentApprovalEvent = BaseEvent<'task-breakdown-agent-approval', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
}>

export type TaskBreakdownAgentRejectionEvent = BaseEvent<'task-breakdown-agent-rejection', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  reason: string
}>

export type TaskStartEvent = BaseEvent<'task-start', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
}>

export type TaskQuestionEvent = BaseEvent<'task-question', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  questionId: number
  question: string
}>

export type TaskAnswer = BaseEvent<'task-answer', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  questionId: number
  answer: string
}>

export type TaskImplementationReportEvent = BaseEvent<'task-implementation-report', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
  report: ImplementationReport
}>

export type TaskUserReviewRequest = BaseEvent<'task-user-review-request', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
}>

export type TaskUserApproval = BaseEvent<'task-user-approval', {
  planId: PlanID
  planRevisionId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
}>

export type TaskUserRejection = BaseEvent<'task-user-rejection', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
  reason: string
}>

export type TaskAgentReviewRequestEvent = BaseEvent<'task-agent-review-request', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
}>

export type TaskAgentReviewQuestionEvent = BaseEvent<'task-agent-review-question', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
  questionId: number
  question: string
}>

export type TaskAgentReviewAnswerEvent = BaseEvent<'task-agent-review-answer', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
  questionId: number
  answer: string
}>

export type TaskAgentApprovalEvent = BaseEvent<'task-agent-approval', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
}>

export type TaskAgentRejectionEvent = BaseEvent<'task-agent-rejection', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
  reason: string
}>

export type TaskCompletedEvent = BaseEvent<'task-agent-completed', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  taskId: number
  taskRevisionId: number
}>

export type PlanUserVerificationRequestEvent = BaseEvent<'plan-user-verification-request', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  planVerificationId: number
}>

export type PlanUserVerificationApprovalEvent = BaseEvent<'plan-user-verification-approval', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  planVerificationId: number
}>

export type PlanUserVerificationRejectionEvent = BaseEvent<'plan-user-verification-rejection', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  planVerificationId: number
  reason: string
}>

export type PlanAgentVerificationRequestEvent = BaseEvent<'plan-agent-verification-request', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  planVerificationId: number
}>

export type PlanAgentVerificationQuestionEvent = BaseEvent<'plan-agent-verification-question', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  planVerificationId: number
  questionId: number
}>

export type PlanAgentVerificationAnswerEvent = BaseEvent<'plan-agent-verification-answer', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  planVerificationId: number
  questionId: number
  answer: string
}>

export type PlanAgentVerificationApprovalEvent = BaseEvent<'plan-agent-verification-approval', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  planVerificationId: number
}>

export type PlanAgentVerificationRejectionEvent = BaseEvent<'plan-agent-verification-rejection', {
  planId: PlanID
  planRevisionId: number
  breakdownId: number
  breakdownRevisionId: number
  planVerificationId: number
  reason: string
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

export type DuctusEvent =
  | TerminateProcessorEvent
  | FeatureRequestEvent
  | PlanCreatedEvent
  | PlanQuestionEvent
  | PlanAnswer
  | PlanProposalEvent
  | PlanUserReviewRequestEvent
  | PlanUserApprovalEvent
  | PlanUserRejectionEvent
  | PlanAgentReviewRequestEvent
  | PlanAgentReviewQuestionEvent
  | PlanAgentReviewAnswerEvent
  | PlanAgentApprovalEvent
  | PlanAgentRejectionEvent
  | TaskBreakdownRequestEvent
  | TaskBreakdownQuestionEvent
  | TaskBreakdownAnswerEvent
  | TaskBreakdownProposalEvent
  | TaskBreakdownUserReviewRequestEvent
  | TaskBreakdownUserApprovalEvent
  | TaskBreakdownUserRejectionEvent
  | TaskBreakdownAgentReviewRequestEvent
  | TaskBreakdownAgentReviewQuestionEvent
  | TaskBreakdownAgentReviewAnswerEvent
  | TaskBreakdownAgentApprovalEvent
  | TaskBreakdownAgentRejectionEvent
  | TaskStartEvent
  | TaskQuestionEvent
  | TaskAnswer
  | TaskImplementationReportEvent
  | TaskUserReviewRequest
  | TaskUserApproval
  | TaskUserRejection
  | TaskAgentReviewRequestEvent
  | TaskAgentReviewQuestionEvent
  | TaskAgentReviewAnswerEvent
  | TaskAgentApprovalEvent
  | TaskAgentRejectionEvent
  | TaskCompletedEvent
  | PlanUserVerificationRequestEvent
  | PlanUserVerificationApprovalEvent
  | PlanUserVerificationRejectionEvent
  | PlanAgentVerificationRequestEvent
  | PlanAgentVerificationQuestionEvent
  | PlanAgentVerificationAnswerEvent
  | PlanAgentVerificationApprovalEvent
  | PlanAgentVerificationRejectionEvent
  | AgentStartedReasoningEvent
  | AgentCompletedReasoningEvent
  | AgentStartedResponseEvent
  | AgentResponseChunkEvent
  | AgentCompletedResponseEvent
