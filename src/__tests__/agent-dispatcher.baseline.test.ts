import { AgentDispatcher } from '../core/agent-dispatcher.js'
import { AgentEntity, HandoffConfig } from '../interfaces/entities/agent-entity.js'
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

describe('AgentDispatcher (Exhaustive Baseline)', () => {
    let mockAgent: AgentEntity
    let mockModel: ModelEntity
    let mockAdapterFactory: jest.Mocked<AdapterEntity>
    let mockAdapter: jest.Mocked<AgentAdapter>
    let mockSecondAdapter: jest.Mocked<AgentAdapter>
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
            process: jest.fn().mockImplementation(async function* () { yield { type: 'text', content: '{}', timestamp: 1 } }),
            terminate: jest.fn().mockResolvedValue(undefined),
        } as any

        mockSecondAdapter = {
            initialize: jest.fn().mockResolvedValue(undefined),
            process: jest.fn().mockImplementation(async function* () { yield { type: 'text', content: '{}', timestamp: 1 } }),
            terminate: jest.fn().mockResolvedValue(undefined),
        } as any

        mockAdapterFactory = {
            create: jest.fn().mockReturnValueOnce(mockAdapter).mockReturnValueOnce(mockSecondAdapter),
        } as any

        const mockParse = jest.fn((v) => v)
        mockAgent = {
            name: 'test-agent',
            role: 'tester',
            persona: 'Test Persona',
            systemPrompt: 'Test System Prompt',
            rules: ['rule1', 'rule2'],
            rulesets: [{ name: 'RuleSet A', rules: ['rs1', 'rs2'] }],
            skill: [
                {
                    name: 'test-skill',
                    input: { schema: { parse: mockParse } as any, payload: 'test-template.mx' },
                    output: { parse: mockParse } as any,
                } as unknown as SkillEntity,
                {
                    name: 'no-template-skill',
                    input: { schema: { parse: mockParse } as any },
                    output: { parse: mockParse } as any,
                } as unknown as SkillEntity
            ],
        } as unknown as AgentEntity

        mockModel = {} as ModelEntity

        mockLedger = {
            readEvents: jest.fn().mockImplementation(async function* () { }),
        } as any

        mockStore = {
            getState: jest.fn().mockReturnValue({ globalState: 'active' }),
        } as any

        mockTemplateRenderer = jest.fn((template, context) => `RENDERED[${template}]`)

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

    describe('Initialization & System Prompt Composition', () => {
        it('composes a complex system message with persona, rules, and system prompt on first invocation', async () => {
            mockAdapter.process.mockImplementation(async function* () {
                yield { type: 'text', content: '{"status": "initialized"}', timestamp: 100 }
            })

            const iterator = dispatcher.invoke('test-agent', 'test-skill', { data: 123 })[Symbol.asyncIterator]()
            await iterator.next()

            expect(mockAdapterFactory.create).toHaveBeenCalledWith(mockAgent, mockModel)

            // The template renderer should be called twice during system message composition:
            // 1. For Persona (inline rendering with mapped rules)
            // 2. For System Prompt (inline rendering with store state)

            const initCall = mockAdapter.initialize.mock.calls[0]?.[0]
            expect(initCall).toBeDefined()
            expect(initCall!.messages[0].role).toBe('system')
            expect(initCall!.messages[0].content).toContain('RENDERED[Test Persona')
            expect(initCall!.messages[0].content).toContain('- rule1')
            expect(initCall!.messages[0].content).toContain('RuleSet A:')
            expect(initCall!.messages[0].content).toContain('RENDERED[Test System Prompt]')

            expect(mockTemplateRenderer).toHaveBeenCalledWith(
                expect.stringContaining('Test Persona'),
                expect.objectContaining({ rules: mockAgent.rules })
            )
            expect(mockTemplateRenderer).toHaveBeenCalledWith(
                'Test System Prompt',
                expect.objectContaining({ state: { globalState: 'active' } })
            )
        })

        it('throws if invoking an unknown agent', async () => {
            const iterator = dispatcher.invoke('ghost-agent', 'test-skill', {})[Symbol.asyncIterator]()
            await expect(iterator.next()).rejects.toThrow("Agent 'ghost-agent' not found.")
        })

        it('throws if invoking an unknown skill', async () => {
            const iterator = dispatcher.invoke('test-agent', 'ghost-skill', {})[Symbol.asyncIterator]()
            await expect(iterator.next()).rejects.toThrow("Skill 'ghost-skill' not found on agent 'test-agent'.")
        })
    })

    describe('Invoke Loop & State Tracking', () => {
        it('tracks token usage, failures, and updates execution sequences over multiple turns', async () => {
            // Turn 1
            mockAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'usage', inputTokens: 50, outputTokens: 25, timestamp: 1 }
                yield { type: 'text', content: '{"status":"ok"}', timestamp: 2 }
            })

            let iterator = dispatcher.invoke('test-agent', 'test-skill', {})[Symbol.asyncIterator]()
            while (!(await iterator.next()).done) { }

            // internal sequence should advance based on sequence tracking algorithm
            // (currentTurnStartSequence = lastKnownSequence + 1) -> 0 + 1 = 1
            // turns = 1. lastKnownSequence = max(0, 1 + 1) = 2.

            // Turn 2 (with an error)
            mockAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'error', reason: 'unknown', code: '500', message: 'Fail', timestamp: 3 }
            })

            iterator = dispatcher.invoke('test-agent', 'test-skill', {})[Symbol.asyncIterator]()
            while (!(await iterator.next()).done) { }

            // Getting internal state indirectly by triggering a handoff to observe the template failure count
            mockAgent.maxFailures = 0 // trigger immediate handoff on next turn
            mockAgent.handoffs = [{ reason: 'failure', template: 'fail.mx' }]

            mockSecondAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'text', content: 'recovered', timestamp: 4 }
            })

            iterator = dispatcher.invoke('test-agent', 'test-skill', {})[Symbol.asyncIterator]()
            await iterator.next()

            // Verify handoff was passed the accumulated state stats
            expect(mockTemplateRenderer).toHaveBeenCalledWith(
                'FILE_CONTENT',
                expect.objectContaining({
                    failureCount: 1,
                    reason: 'failure',
                    // The old adapter tracked its tokens and turns.
                })
            )
        })

        it('renders the skill input template before passing it to the adapter', async () => {
            mockAdapter.process.mockImplementation(async function* () {
                yield { type: 'text', content: '...', timestamp: 1 }
            })

            const iterator = dispatcher.invoke('test-agent', 'test-skill', { userParam: 'hello' })[Symbol.asyncIterator]()
            await iterator.next()

            expect(mockSystemAdapter.resolveAbsolutePath).toHaveBeenCalledWith('test-template.mx')
            expect(mockFileAdapter.read).toHaveBeenCalledWith('/absolute/test-template.mx')
            expect(mockTemplateRenderer).toHaveBeenCalledWith('FILE_CONTENT', expect.objectContaining({ userParam: 'hello' }))

            expect(mockAdapter.process).toHaveBeenCalledWith('RENDERED[FILE_CONTENT]')
        })

        it('JSON strings the input if no skill payload template is provided', async () => {
            mockAdapter.process.mockImplementation(async function* () {
                yield { type: 'text', content: '...', timestamp: 1 }
            })

            const iterator = dispatcher.invoke('test-agent', 'no-template-skill', { userParam: 'hello' })[Symbol.asyncIterator]()
            await iterator.next()

            expect(mockAdapter.process).toHaveBeenCalledWith('{"userParam":"hello"}')
        })
    })

    describe('invokeAndParse (Regex Extraction Brittleness)', () => {
        it('extracts structured output when text contains markdown brackets', async () => {
            mockAdapter.process.mockImplementation(async function* () {
                yield { type: 'text', content: 'Here is the data:\n```json\n{"key": "value", "arr": [1,2]}\n```', timestamp: 1 }
            })

            const res = await dispatcher.invokeAndParse('test-agent', 'test-skill', {})
            expect(res).toEqual({ key: 'value', arr: [1, 2] })
        })

        it('throws when the extracted block is invalid JSON due to aggressive regex matching', async () => {
            mockAdapter.process.mockImplementation(async function* () {
                // Testing the fragility: A regex /[\[{][\s\S]*[\]}]/ matches from the first '{' or '[' to the last '}' or ']'.
                yield { type: 'text', content: 'I thought about using an array like [1, 2, 3] but I decided to return: {"key":"value"}', timestamp: 1 }
            })

            // The exact regex behavior will extract: "[1, 2, 3] but I decided to return: {"key":"value"}"
            // This is invalid JSON.
            await expect(dispatcher.invokeAndParse('test-agent', 'test-skill', {})).rejects.toThrow()
        })

        it('throws if no brackets are found at all', async () => {
            mockAdapter.process.mockImplementation(async function* () {
                yield { type: 'text', content: 'Just a raw string output with no structure.', timestamp: 1 }
            })

            await expect(dispatcher.invokeAndParse('test-agent', 'test-skill', {})).rejects.toThrow("Failed to extract JSON from agent response")
        })
    })

    describe('Lifecycle Enforcement & Handoffs', () => {
        beforeEach(() => {
            mockAgent.handoffs = [
                { reason: 'overflow', template: 'overflow.mx', headEvents: 1, tailEvents: 2 },
                { reason: 'scope', template: 'scope.mx', agentSummary: true }
            ]
        })

        it('replaces the adapter when maxContextTokens is breached', async () => {
            mockAgent.maxContextTokens = 100

            mockAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'usage', inputTokens: 60, outputTokens: 60, timestamp: 1 } // 120 total, breach!
                yield { type: 'text', content: '{}', timestamp: 2 }
            })

            // Turn 1 executes on adapter 1
            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})

            // Provide ledger history for the handoff context
            mockLedger.readEvents.mockImplementation(async function* () {
                yield { type: 'Evt1', payload: 'a', sequenceNumber: 1, timestamp: 10, eventId: '1', isCommited: true, prevHash: '', hash: '', volatility: 'durable' }
                yield { type: 'Evt2', payload: 'b', sequenceNumber: 2, timestamp: 20, eventId: '2', isCommited: true, prevHash: '', hash: '', volatility: 'durable' }
                yield { type: 'Evt3', payload: 'c', sequenceNumber: 3, timestamp: 30, eventId: '3', isCommited: true, prevHash: '', hash: '', volatility: 'durable' }
                yield { type: 'Evt4', payload: 'd', sequenceNumber: 4, timestamp: 40, eventId: '4', isCommited: true, prevHash: '', hash: '', volatility: 'durable' }
            })

            mockSecondAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'text', content: '{}', timestamp: 3 }
            })

            // Turn 2 triggers the limit.
            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})

            expect(mockAdapter.terminate).toHaveBeenCalled()
            expect(mockAdapterFactory.create).toHaveBeenCalledTimes(2) // MockAdapter + MockSecondAdapter

            // Verify handoff template rendering includes head (1) and tail (2) events
            expect(mockFileAdapter.read).toHaveBeenCalledWith('/absolute/overflow.mx')
            expect(mockTemplateRenderer).toHaveBeenCalledWith(
                'FILE_CONTENT',
                expect.objectContaining({
                    reason: 'overflow',
                    headEvents: [
                        expect.objectContaining({ sequence: 1, type: 'Evt1' })
                    ],
                    tailEvents: [
                        expect.objectContaining({ sequence: 3, type: 'Evt3' }),
                        expect.objectContaining({ sequence: 4, type: 'Evt4' })
                    ]
                })
            )

            // Verify new adapter was initialized with the combined system prompt + handoff
            const initCall = mockSecondAdapter.initialize.mock.calls[0][0]
            expect(initCall!.messages[0].content).toContain('RENDERED[Test System Prompt]')
            expect(initCall!.messages[0].content).toContain('RENDERED[FILE_CONTENT]') // The handoff output
        })

        it('requests an agent summary before termination during a scope handoff', async () => {
            mockAgent.scope = { type: 'turn', amount: 1 } as any

            mockAdapter.process.mockImplementation(async function* (prompt: string) {
                if (prompt === 'Provide a concise summary of our conversation so far, including key decisions, context, and outputs.') {
                    yield { type: 'text', content: 'I am a self summary.', timestamp: 2 }
                } else {
                    yield { type: 'text', content: '{}', timestamp: 1 }
                }
            })

            // Turn 1 (completes the scope)
            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})

            mockSecondAdapter.process.mockImplementationOnce(async function* () {
                yield { type: 'text', content: '{}', timestamp: 3 }
            })

            // Turn 2 triggers handoff replacement
            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})

            // Verifies the handoff renderer received the generated agent summary
            expect(mockTemplateRenderer).toHaveBeenCalledWith(
                'FILE_CONTENT',
                expect.objectContaining({
                    reason: 'scope',
                    agentSummary: 'I am a self summary.'
                })
            )
            expect(mockAdapter.terminate).toHaveBeenCalled()
        })
    })

    describe('terminateAll', () => {
        it('terminates all tracked adapters and clears lifecycle state', async () => {
            mockAdapter.process.mockImplementation(async function* () {
                yield { type: 'text', content: '{}', timestamp: 1 }
            })

            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})
            await dispatcher.terminateAll()

            expect(mockAdapter.terminate).toHaveBeenCalled()

            // A subsequent invoke should recreate the adapter because the lifecycle was cleared
            await dispatcher.invokeAndParse('test-agent', 'test-skill', {})
            expect(mockAdapterFactory.create).toHaveBeenCalledTimes(2)
        })
    })
})
