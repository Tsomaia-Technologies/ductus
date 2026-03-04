import { AgentDispatcher } from '../core/agent-dispatcher.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AdapterEntity, AgentAdapter } from '../interfaces/entities/adapter-entity.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../../research/interfaces/adapters.js'
import { Injector } from '../interfaces/event-generator.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { Schema } from '../interfaces/schema.js'

describe('AgentDispatcher (Baseline)', () => {
    let mockAgent: AgentEntity
    let mockModel: ModelEntity
    let mockAdapterFactory: AdapterEntity
    let mockAdapter: jest.Mocked<AgentAdapter>
    let mockLedger: jest.Mocked<EventLedger<CommittedEvent<BaseEvent>>>
    let mockStore: jest.Mocked<StoreAdapter<any, any>>
    let mockTemplateRenderer: jest.Mock
    let mockSystemAdapter: jest.Mocked<SystemAdapter>
    let mockFileAdapter: jest.Mocked<FileAdapter>
    let mockInjector: jest.Mocked<Injector>
    let dispatcher: AgentDispatcher<any, any>

    beforeEach(() => {
        mockAdapter = {
            initialize: jest.fn().mockResolvedValue(undefined),
            process: jest.fn(),
            terminate: jest.fn().mockResolvedValue(undefined),
        } as any

        mockAdapterFactory = {
            create: jest.fn().mockReturnValue(mockAdapter),
        } as any

        mockAgent = {
            name: 'test-agent',
            role: 'tester',
            persona: 'Test Persona',
            systemPrompt: 'Test System Prompt',
            rules: [],
            rulesets: [],
            skill: [
                {
                    name: 'test-skill',
                    input: { schema: { parse: jest.fn((v) => v) } as any, payload: 'test-template.mx' },
                    output: { parse: jest.fn((v) => v) } as any,
                } as unknown as SkillEntity
            ],
        } as unknown as AgentEntity

        mockModel = {} as ModelEntity

        mockLedger = {
            readEvents: jest.fn().mockImplementation(async function* () { }),
        } as any

        mockStore = {
            getState: jest.fn().mockReturnValue({}),
        } as any

        mockTemplateRenderer = jest.fn((template, context) => `RENDERED: ${template}`)

        mockSystemAdapter = {
            resolveAbsolutePath: jest.fn((p) => `/absolute/${p}`),
        } as any

        mockFileAdapter = {
            read: jest.fn().mockResolvedValue('FILE_CONTENT'),
        } as any

        mockInjector = {} as any

        dispatcher = new AgentDispatcher({
            agents: [{ agent: mockAgent, model: mockModel, adapter: mockAdapterFactory }],
            ledger: mockLedger,
            store: mockStore,
            templateRenderer: mockTemplateRenderer,
            systemAdapter: mockSystemAdapter,
            fileAdapter: mockFileAdapter,
            injector: mockInjector,
        })
    })

    describe('Big Object Entanglements (To Be Refactored)', () => {

        it('currently parses structured output using brittle regex (Needs Delegation to Adapter)', async () => {
            const skill = mockAgent.skill[0]

            // Mock adapter yielding text with embedded JSON
            mockAdapter.process.mockImplementation(async function* () {
                yield { type: 'text', content: 'Here is the result:\n```json\n{"result": "success"}\n```', timestamp: 100 }
            })

            // The dispatcher's internal parseStructuredOutput uses regex /[{][\\s\\S]*[}]/
            const result = await dispatcher.invokeAndParse('test-agent', 'test-skill', { some: 'input' })

            expect(mockAdapter.process).toHaveBeenCalled()
            // We expect the schema.parse of the original skill's output to be called with the extracted JSON
            expect(skill.output.parse).toHaveBeenCalledWith({ result: 'success' })
        })

        it('currently handles template rendering directly (Needs Interceptor Pipeline)', async () => {
            mockAdapter.process.mockImplementation(async function* () {
                yield { type: 'text', content: '{"status": "ok"}', timestamp: 100 }
            })

            const iterator = dispatcher.invoke('test-agent', 'test-skill', { data: 123 })[Symbol.asyncIterator]()
            await iterator.next()

            // Verifying the dispatcher reads the file and calls the template renderer itself
            expect(mockSystemAdapter.resolveAbsolutePath).toHaveBeenCalledWith('test-template.mx')
            expect(mockFileAdapter.read).toHaveBeenCalledWith('/absolute/test-template.mx')
            expect(mockTemplateRenderer).toHaveBeenCalledWith('FILE_CONTENT', { data: 123 })
        })

        it('currently tracks token limits and triggers handoff directly (Needs Interceptor Pipeline)', async () => {
            mockAgent.maxContextTokens = 100
            mockAgent.handoffs = [{ reason: 'overflow', template: 'overflow.mx' }]

            // First turn: Use 60 tokens
            mockAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'usage', inputTokens: 40, outputTokens: 20, timestamp: 100 }
                yield { type: 'text', content: '{"status": "turn1"}', timestamp: 101 }
            })

            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})

            // Second turn: Use another 60 tokens, crossing the 100 limit
            mockAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'usage', inputTokens: 40, outputTokens: 20, timestamp: 100 }
                yield { type: 'text', content: '{"status": "turn2"}', timestamp: 101 }
            })

            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})

            // Third turn: Should trigger handoff BEFORE processing
            mockAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'text', content: '{"status": "turn3"}', timestamp: 100 }
            })

            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})

            // Adapter factory should be called twice (initial + one replacement)
            expect(mockAdapterFactory.create).toHaveBeenCalledTimes(2)
            expect(mockAdapter.terminate).toHaveBeenCalledTimes(1)
        })
    })
})
