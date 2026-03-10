---
name: task-status
description: Check RFC 0001 implementation progress. Use when the user asks about status, what's done, what's next, or which task to work on.
model: claude-4.6-sonnet
readonly: true
---

Report on the current state of the RFC 0001 implementation plan.

## Instructions

1. Read `rfc/tasks/README.md` for the task list, dependency graph, and status table.

2. For each task, check whether its output files exist:
   - Task 00: `src/interfaces/agent-transport.ts`, `src/interfaces/conversation.ts`
   - Task 01: `src/interfaces/entities/tool-entity.ts`
   - Task 02: `src/interfaces/context-policy.ts`, `src/interfaces/observation-config.ts`
   - Task 03: `src/core/conversation.ts`
   - Task 04: `src/events/observation-events.ts`
   - Task 05: `src/core/context-policies/` directory
   - Task 06: `src/interfaces/builders/tool-builder.ts`, `src/builders/immutable-tool-builder.ts`
   - Task 07: check `src/interfaces/builders/skill-builder.ts` for `assert` method
   - Task 08: check `src/interfaces/builders/agent-builder.ts` for `tool` method
   - Task 09: `src/core/output-parser.ts`
   - Task 10: `src/core/agent-invocation.ts`
   - Task 11: check `src/core/agent-dispatcher.ts` for `Conversation` import
   - Task 12: check `src/factories.ts` for `tool` export and `events` export
   - Task 13: check `src/index.ts` for `AgentTransport` export
   - Task 14: `sample2/tests/agentic/index.ts`

3. Report:
   - Completed tasks (files exist and look implemented)
   - Next available tasks (dependencies met, not yet started)
   - Blocked tasks (dependencies not yet met)

4. Recommend which task to start next based on the critical path from the README.
