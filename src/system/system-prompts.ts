/**
 * Default framework-level prompts used internally by Ductus.
 * These are defaults — users can override them via configuration.
 */

export const DEFAULT_SUMMARIZATION_PROMPT = [
    'Provide a concise summary of our entire conversation so far.',
    'Include all key decisions, context, constraints, and outputs.',
    'This summary will be used to continue the work in a fresh session.',
].join(' ')
