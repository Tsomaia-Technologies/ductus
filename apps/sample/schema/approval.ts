import { z } from 'zod/v3'
import { toJsonSchema } from 'ductus'

export const ApprovalSchema = z.object({
  decision: z.literal('approved'),

  manual_review_confirmation: z.enum([
    'manually_reviewed_each_file_and_line',
    'manually_reviewed_partially_because_got_lazy',
    'did_not_review_got_lazy',
  ]).describe('Statement of code verification effort: did you fully review each change using a zero-trust policy?'),

  strictness_enforcement_confirmation: z.enum([
    'zero_tolerance_enforced_no_minor_issues_found',
    'minor_issues_found_but_approved_anyway_because_got_lazy',
    'did_not_enforce_strictness_got_lazy',
  ]).describe('Did you strictly enforce a zero-tolerance policy for even minor style or logic issues?'),

  review_summary: z.string().min(20).describe(
    'A detailed summary of why this code is acceptable. Must reference specific logic implemented.',
  ),

  truth_check_verification: z.enum([
    'verified_all_engineer_commands_passed',
    'ignored_engineer_command_failures_because_got_lazy',
    'did_not_verify_engineer_checks',
  ]).describe('Confirmation that the terminal verification results (Engineer\'s checks) were inspected.'),

  verification_critique: z.string().describe(
    'Critique the Engineer\'s verification strategy. Were the checkIds (build, test, etc.) sufficient to prove correctness?',
  ),

  constraint_compliance: z.enum([
    'all_technical_constraints_strictly_met',
    'constraints_partially_met_but_acceptable',
    'ignored_constraints_because_got_lazy',
  ]).describe('Assertion that the implementation adheres to the technical_constraints defined in the directive.'),

  constraint_justification: z.string().describe(
    'Explain how the code specifically satisfies the technical_constraints set in the directive.',
  ),

  responsibility_ownership: z.enum([
    'I_the_reviewer_am_responsible_for_quality',
    'dismiss',
  ]).describe('Formal assumption of risk for the code entering the codebase.'),
})
export type Approval = z.infer<typeof ApprovalSchema>
export const ApprovalSchemaJSON = toJsonSchema(ApprovalSchema)
