import { ZodSchema } from 'zod/v3'

export type AgentType =
  | 'plan-creator'
  | 'plan-auditor'
  | 'task-creator'
  | 'task-auditor'
  | 'engineer'
  | 'reviewer'
  | 'auditor'

export interface AgentRole<
  TType extends AgentType | unknown = unknown,
  TContext extends object | unknown = unknown,
  TOutput extends ZodSchema | unknown = unknown
> {
  type(): TType
  persona(context: TContext): string
  allowedTools(): string[]
  schema(): TOutput
}
