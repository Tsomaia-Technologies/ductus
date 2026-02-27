# Task: 001-core-event-contracts

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Immutability and Fail-Fast rules)
- `rfc-001.revision-06.md` (Section 4.1 Event Interface Contract)

## 1. Objective & Responsibility
Define the fundamental Zod schemas and TypeScript interfaces for the Immutable Ledger. This package (`@ductus/core`) defines the exact shape of `DuctusEvent`, `BaseEvent`, `CommitedEvent`, and the `volatility` union that drives the entire Event Sourcing loop. This is the foundational type system every other Processor depends on.

## 2. Invariants & Global Contracts (The Happy Path)
- **Volatility Guarantee:** The `volatility` union (`'durable' | 'volatile'`) MUST be present on every event. The architecture relies on this to prevent the Ledger from bloating with UI-only noise like progress bars and token streams.
- **Strict Parse:** All incoming payloads from external boundaries (e.g., human CLI input, LLM JSON responses) MUST be parsed through these strict Zod contracts.

## 3. I/O Boundaries & Dependencies
- **No I/O Allowable:** These are pure TypeScript types and Zod schemas. You MUST NOT import `fs`, `crypto`, or any other OS-level module into this file. 

## 4. Exact Event Signatures (Contract Adherence)
Implement the exact interfaces as described in the blueprint:
- `BaseEvent`: Represents an intentional action waiting to be stamped. Must include `type`, `payload`, `authorId`, `timestamp`, and `volatility` (using `-draft` suffixes).
- `CommitedEvent`: Represents an immutable historical fact after Hub processing. Extends `BaseEvent` but guarantees `id` (UUID), `sequence` (integer), `prevHash`, and `hash` (SHA-256).

## 5. Lifecycle & Unhappy Path
- **Schema Rejection:** If a developer attempts to construct a `BaseEvent` without an explicit `volatility` flag, the Type System MUST fail at compile time, and the Zod Schema MUST throw a validation error at runtime. Fail fast.

## 6. Required Execution Constraints
- Do not write concrete classes or helper methods. This file is strictly for `interface` and `zod` definitions.
- Export utility types that allow Processors to infer payload types strictly based on the string `type` discriminator.

## 7. Definition of Done
1. **The Validation Barrier:** Write a Jest test that passes an untyped `any` object to `DuctusEventSchema.parse()`. Assert that omitting the `authorId` or passing an invalid `volatility` string throws an immediate validation error.
