# Task: 019-telemetry-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Event Stream Volatility)
- `rfc-001.revision-06.md` (Section 5.1 Metrics Tracking)

## 1. Objective & Responsibility
Implement the `TelemetryProcessor` (The Accountant/Metabolism). This strictly observational processor sits on the Hub and monitors the high-volume chatter to compile aggregate system metrics. It transforms low-level granular events into high-level human insights (e.g., total token usage across a session, estimated API cost, execution duration).

## 2. Invariants & Global Contracts (The Happy Path)
- **Passive Observer Guarantee:** The system's logical state MUST NEVER branch or change based on the output of this Processor. It has zero power to halt the execution loop or influence the Type Machine Reducer. Its sole job is compilation.
- **Volatile Outputs Only:** The metrics (e.g., `TELEMETRY_UPDATED`) yielded by this Processor are for immediate UI consumption by the `LoggerProcessor` only. It must yield exclusively `volatile` events. If you generate `durable` events here, every single LLM call will double-bloat the Ledger with metric metadata.

## 3. I/O Boundaries & Dependencies
- **Strictly Passive:** No Adapter injections are required. It performs internal mathematics based purely on event footprints. If future configuration requires writing to a Prometheus endpoint, this strict boundary allows it without touching core engine logic.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens To:** `AGENT_REPORT_RECEIVED`, `TOOL_COMPLETED` (Optional, if tracking OS durations), `SYSTEM_START` (To zero counters).
- **Yields (Volatile):** `TELEMETRY_UPDATED` (Must include accumulating JSON aggregates, and MUST assert `volatility: 'volatile-draft'`).

## 5. Lifecycle & Unhappy Path
- **Muted Mode Aggregation:** Unlike the `Logger` which ignores replays, the `TelemetryProcessor` MUST listen to `isReplay: true` events. If the Bootstrapper is hydrating a 3-day old session containing 50 past LLM calls, the `TelemetryProcessor` must silently gobble up the token usage parameters from the replay stream so that its internal metrics counter accurately reflects the correct total token burn when the system crosses into Live Mode.
- **Panic Clears:** If `CIRCUIT_INTERRUPTED` or `SYSTEM_HALT` is commanded, dump a final telemetry event to the Logger and reset the accumulators.

## 6. Required Execution Constraints
- Manage internal numerical properties tracking `totalInputTokens` and `totalOutputTokens`, grouped by LLM model identity.
- Listen to `AGENT_REPORT_RECEIVED` events and strictly extract the `.payload.usage` metadata.

## 7. Definition of Done
1. **The Replay Accrual Proof:** Feed the processor an `AGENT_REPORT_RECEIVED` event containing 10,000 input tokens, explicitly tagged with `isReplay: true`. Assert that the event is processed and added to the internal class state (or returned via an internal debug method), proving the `TelemetryProcessor` successfully read a replayed event. Then, assert that a `TELEMETRY_UPDATED` event is yielded.
2. **The Volatile Filter Proof:** Assert that every single event yielded from this processor forcefully possesses `volatility: 'volatile-draft'`.
