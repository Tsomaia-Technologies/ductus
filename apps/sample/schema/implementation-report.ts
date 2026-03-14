import { z } from 'zod/v3'
import { toJsonSchema } from 'ductus'

export const RequestedCheckSchema = z.object({
  checkId: z.string().describe('Id of a check defined in .ductus/config.json'),
  args: z.array(z.string()).optional().describe('Optional arguments for scoped checks (e.g. file paths for linter)'),
})

export const ImplementationReportSchema = z.object({
  files_modified: z.array(z.string()).describe('List of all files actually changed during implementation.'),
  self_review_status: z.enum([
    'manually_reviewed_and_confirmed',
    'manually_reviewed_and_ignored_issues',
    'did_not_review_got_lazy',
  ]).describe('Implementation\'s self-assessment of the code quality before submission.'),
  requested_checks: z.array(RequestedCheckSchema).describe('Check IDs to run from .ductus/config.json (e.g. build, test). Only these are executed.'),
  coverage_status: z.enum(['new_functionality_fully_covered', 'got_lazy']).describe('Confirmation of test coverage for new logic.'),
  implementation_status: z.enum(['fully_implemented', 'got_lazy']).describe('Confirmation that all requirements from the spec were addressed.'),
  implementation_notes: z.string().describe('Details regarding the technical choices or hurdles encountered during coding.'),
  responsibility_ownership: z.enum(['I_the_engineer_am_responsible', 'dismiss']).describe('A formal claim of responsibility for the submitted work.'),
  commitMessage: z.string().describe(
    'Commit message in Conventional Commits format (e.g. feat(auth): add login endpoint). ' +
    'See https://www.conventionalcommits.org/ . Leave empty to use task summary.',
  ),
})

export type RequestedCheck = z.infer<typeof RequestedCheckSchema>
export type ImplementationReport = z.infer<typeof ImplementationReportSchema>
export const ImplementationReportSchemaJSON = toJsonSchema(ImplementationReportSchema)
