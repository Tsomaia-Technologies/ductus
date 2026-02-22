import { z } from 'zod/v3'
import { toJsonSchema } from './utils'

export const PlannerHeadersSchema = z.object({
  model: z.enum(['auto']).default('auto'),
})

export const TaskSchema = z.object({
  id: z.string().describe('Kebab-case slug, e.g. db-setup, auth-api'),
  summary: z.string().min(20).describe('One-line summary for headline and human review'),
  description: z.string().min(20).describe('Full details for the Engineer. In case of bugs - steps to reproduce, current state, expected state. In case of tasks any detail that adds helpful context.'),
  objective: z.string().min(20).describe('The primary goal of this task.'),
  requirements: z.array(z.string()).describe('Specific functional requirements to be met.'),
  constraints: z.array(z.string()).describe('Non-functional requirements or architectural boundaries.'),
})
export type Task = z.infer<typeof TaskSchema>
export const TaskSchemaJSON = toJsonSchema(TaskSchema)

export const TaskListSchema = z.array(TaskSchema);
export type TaskList = z.infer<typeof TaskListSchema>
export const TaskListSchemaJSON = toJsonSchema(TaskSchema)

export const CommandStatusSchema = z.object({
  checkId: z.string().describe('Identifier for the check, e.g., "build", "tests", "linter"'),
  status: z.enum(['passed', 'failed', 'got_lazy']).describe('The result of the command execution.'),
  command: z.string().describe('The exact shell command executed to verify the implementation.'),
  relative_path: z.string().default('.').describe('The directory relative to project root where the command was run.'),
})
export type CommandStatus = z.infer<typeof CommandStatusSchema>
export const CommandStatusSchemaJSON = toJsonSchema(CommandStatusSchema)


export const EngineerReportSchema = z.object({
  files_modified: z.array(z.string()).describe('List of all files actually changed during implementation.'),
  self_review_status: z.enum([
    'manually_reviewed_and_confirmed',
    'manually_reviewed_and_ignored_issues',
    'did_not_review_got_lazy'
  ]).describe('Engineer\'s self-assessment of the code quality before submission.'),
  checks: z.array(CommandStatusSchema).describe('List of terminal commands run to prove implementation validity. These are self-reported attestations — the server does NOT execute them.'),
  coverage_status: z.enum(['new_functionality_fully_covered', 'got_lazy']).describe('Confirmation of test coverage for new logic.'),
  implementation_status: z.enum(['fully_implemented', 'got_lazy']).describe('Confirmation that all requirements from the spec were addressed.'),
  implementation_notes: z.string().describe('Details regarding the technical choices or hurdles encountered during coding.'),
  responsibility_ownership: z.enum(['I_the_engineer_am_responsible', 'dismiss']).describe('A formal claim of responsibility for the submitted work.'),
})
export type EngineerReport = z.infer<typeof EngineerReportSchema>
export const EngineerReportSchemaJSON = toJsonSchema(EngineerReportSchema)

export const ApprovalSchema = z.object({
  decision: z.literal('approved'),

  manual_review_confirmation: z.enum([
    'manually_reviewed_each_file_and_line',
    'manually_reviewed_partially_because_got_lazy',
    'did_not_review_got_lazy'
  ]).describe('Statement of code verification effort: did you fully review each change using a zero-trust policy?'),

  strictness_enforcement_confirmation: z.enum([
    'zero_tolerance_enforced_no_minor_issues_found',
    'minor_issues_found_but_approved_anyway_because_got_lazy',
    'did_not_enforce_strictness_got_lazy'
  ]).describe('Did you strictly enforce a zero-tolerance policy for even minor style or logic issues?'),

  review_summary: z.string().min(20).describe(
    'A detailed summary of why this code is acceptable. Must reference specific logic implemented.'
  ),

  truth_check_verification: z.enum([
    'verified_all_engineer_commands_passed',
    'ignored_engineer_command_failures_because_got_lazy',
    'did_not_verify_engineer_checks'
  ]).describe('Confirmation that the terminal verification results (Engineer\'s checks) were inspected.'),

  verification_critique: z.string().describe(
    'Critique the Engineer\'s verification strategy. Were the checkIds (build, test, etc.) sufficient to prove correctness?'
  ),

  constraint_compliance: z.enum([
    'all_technical_constraints_strictly_met',
    'constraints_partially_met_but_acceptable',
    'ignored_constraints_because_got_lazy'
  ]).describe('Assertion that the implementation adheres to the technical_constraints defined in the directive.'),

  constraint_justification: z.string().describe(
    'Explain how the code specifically satisfies the technical_constraints set in the directive.'
  ),

  responsibility_ownership: z.enum([
    'I_the_reviewer_am_responsible_for_quality',
    'dismiss'
  ]).describe('Formal assumption of risk for the code entering the codebase.'),
})
export type Approval = z.infer<typeof ApprovalSchema>
export const ApprovalSchemaJSON = toJsonSchema(ApprovalSchema)

export const RejectionSchema = z.object({
  decision: z.literal('rejected'),
  rejection_reason: z.string().describe('High-level explanation of why the work failed to meet standards.'),
  required_fixes: z.array(z.string()).describe('List of mandatory changes the Engineer must implement for the next submission.'),
  suggestions: z.array(z.string()).optional().describe('Non-mandatory suggestions to the identified issues, possible improvements and/or architectural advice.'),
})
export type Rejection = z.infer<typeof RejectionSchema>
export const RejectionJSON = toJsonSchema(RejectionSchema)

export const ReviewResultSchema = z.discriminatedUnion('decision', [
  ApprovalSchema,
  RejectionSchema,
])
export type ReviewResult = z.infer<typeof ReviewResultSchema>
