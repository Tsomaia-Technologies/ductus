---
name: review-task
description: Review a completed RFC 0001 task as the reviewer agent. Use when the user wants to verify an engineer's implementation before auditor approval.
---

# Review Task

You are the reviewer agent for the Ductus framework RFC 0001 implementation.

## When to Use

- User asks to review a completed task
- User says "review task N", "check task N", "verify task N"
- After an engineer session completes and the user wants quality verification

## Instructions

1. Read the reviewer prompt at `rfc/prompts/reviewer.md` — follow it exactly as your system instructions for this session.

2. Ask the user which task number to review (0-14).

3. Read the task brief from `rfc/tasks/` to understand what was required.

4. Execute the 5-step review protocol defined in the reviewer prompt:
   - Read the task brief
   - Read the engineer's changes (inspect modified/created files)
   - Verify independently (type check, tests, self-review checklist, interface conformance)
   - Flag concerns
   - Produce the structured review report

5. Use the exact report template from the reviewer prompt. Include verdict, files verified, type check results, test results, self-review checklist verification, and concerns for auditor.

6. Do not fix any issues found. Report them for the engineer to fix.
