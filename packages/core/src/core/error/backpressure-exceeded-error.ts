export class BackpressureExceededError extends Error {
  constructor(
    public readonly subscriberName: string | null,
    public readonly queueSize: number,
    public readonly threshold: number,
  ) {
    super(
      `Backpressure threshold exceeded: subscriber "${subscriberName ?? '(unnamed)'}" ` +
      `has ${queueSize} queued events (threshold: ${threshold})`,
    )
  }
}
