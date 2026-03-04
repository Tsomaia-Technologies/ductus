import { AgentInterceptor, InvocationContext, InterceptorNext } from '../agent-interceptor.js'
import { TemplateRenderer } from '../../agent-dispatcher.js'
import { FileAdapter } from '../../../../research/interfaces/adapters.js'
import { SystemAdapter } from '../../../interfaces/system-adapter.js'

export class TemplateInterceptor implements AgentInterceptor {
    constructor(
        private readonly fileAdapter: FileAdapter,
        private readonly systemAdapter: SystemAdapter,
        private readonly renderer: TemplateRenderer
    ) { }

    async* intercept(context: InvocationContext, next: InterceptorNext) {
        const skill = context.skill
        if (!skill) {
            throw new Error("TemplateInterceptor requires a matched skill in context")
        }

        const validatedInput = skill.input.schema.parse(context.input)

        if (skill.input.payload && this.renderer) {
            const templateCtx = typeof validatedInput === 'object' && validatedInput !== null
                ? validatedInput as Record<string, any>
                : { input: validatedInput }

            const templateContent = await this.fileAdapter.read(
                this.systemAdapter.resolveAbsolutePath(skill.input.payload)
            )
            context.prompt = await this.renderer(templateContent, templateCtx)
        } else {
            context.prompt = JSON.stringify(validatedInput)
        }

        yield* next(context)
    }
}
