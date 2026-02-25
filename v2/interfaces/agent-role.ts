export interface AgentRole<TContext extends object> {
  type: string
  persona(context: TContext): string
}
