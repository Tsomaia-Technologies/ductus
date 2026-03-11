export type TemplateRenderer = (template: string, context: Record<string, unknown>) => string | Promise<string>
