import { AgentInterceptor, InvocationContext, InterceptorNext } from '../agent-interceptor.js'

export class ParsingInterceptor implements AgentInterceptor {
    async* intercept(context: InvocationContext, next: InterceptorNext) {
        let accumulatedText = ''

        for await (const chunk of next(context)) {
            if (chunk.type === 'data') {
                const parsedOutput = context.skill!.output.parse(chunk.data)
                context.data.set('parsedOutput', parsedOutput)
                yield chunk
            } else if (chunk.type === 'text') {
                accumulatedText += chunk.content
                yield chunk
            } else {
                yield chunk
            }
        }

        const existingData = context.data.get('parsedOutput')
        if (existingData !== undefined) {
            return // Natively yielded via data chunk
        }

        if (accumulatedText.length > 0 && context.skill) {
            const jsonMatch = accumulatedText.match(/[\[{][\s\S]*[\]}]/)
            if (!jsonMatch) {
                throw new Error(`Failed to extract JSON from agent response for skill '${context.skill.name}'.`)
            }

            try {
                const parsed = JSON.parse(jsonMatch[0])
                context.data.set('parsedOutput', context.skill.output.parse(parsed))
            } catch (e: any) {
                throw new Error(`Failed to parse extracted JSON for skill '${context.skill.name}': ` + e.message)
            }
        }
    }
}
