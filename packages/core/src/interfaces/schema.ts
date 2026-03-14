import { ZodSchema } from 'zod/v3'

/**
 * Schema type used for validation throughout Ductus.
 * Currently backed by Zod. This coupling may be abstracted in a future version.
 * Import `Schema` instead of `ZodSchema` directly to future-proof your code.
 */
export type Schema = ZodSchema
