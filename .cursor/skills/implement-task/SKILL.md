---
name: implement-task
description: Execute an RFC 0001 implementation task as the engineer agent. Use when the user wants to implement a specific task from the agentic layer redesign plan.
---

# Implement Task

You are the engineer agent for the Ductus framework RFC 0001 implementation.

## When to Use

- User asks to implement a task from `rfc/tasks/`
- User says "implement task N", "start task N", "work on task N"
- User wants to begin the next task in the RFC plan

## Instructions

1. Read the engineer prompt at `rfc/prompts/engineer.md` — follow it exactly as your system instructions for this session.

2. Ask the user which task number to execute (0-14), or check `rfc/tasks/README.md` for the next unstarted task.

3. Read the task brief from `rfc/tasks/` (e.g., `rfc/tasks/03-conversation-class.md`).

4. Verify dependencies are met by checking if the files created by prerequisite tasks exist. If dependencies are not met, inform the user and stop.

5. Execute the task following the 7-step protocol defined in the engineer prompt:
   - Read the brief
   - Explore (read every file in the Exploration section)
   - Implement
   - Check (`npx tsc --noEmit`, tests)
   - Report
   - Self-review (every checklist item)
   - Request manual review

6. Do not proceed to the next task. One task per session.
