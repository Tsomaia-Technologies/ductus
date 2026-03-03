import { z } from 'zod/v3'
import { toJsonSchema } from '../utils/schema-utils.js'

export const RejectionSchema = z.object({
  decision: z.literal('rejected'),
  rejection_reason: z.string().describe('High-level explanation of why the work failed to meet standards.'),
  required_fixes: z.array(z.string()).describe('List of mandatory changes the Engineer must implement for the next submission.'),
  suggestions: z.array(z.string()).optional().describe('Non-mandatory suggestions to the identified issues, possible improvements and/or architectural advice.'),
})
export type Rejection = z.infer<typeof RejectionSchema>
export const RejectionJSON = toJsonSchema(RejectionSchema)
