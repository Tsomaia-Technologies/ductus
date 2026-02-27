export type AgentType =
  | 'planner'
  | 'task-creator' // or 'delegator'
  | 'task-auditor'
  | 'engineer'
  | 'reviewer'
  | 'auditor'

export interface AgentRole<TContext extends object, TOutput> {
  type: AgentType
  allowedTools(): string[]
  persona(context: TContext): string
  parse(response: string): TOutput
}
