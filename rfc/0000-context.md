Verdict: The agentic layer is a well-designed skeleton, but it's not yet at "first-class citizen" level. The event sourcing foundation beneath it is production-grade. The agent layer on top is structurally sound but functionally thin.
Let me be specific.

What IS solid
1. Agent identity model is strong. The AgentEntity captures the right abstractions: persona (WHO), systemPrompt (WHAT context), skills (WHAT capabilities), rules/rulesets (HOW to behave), scope (WHEN to rotate), and handoff (HOW to transfer context). This is a genuinely thoughtful agent identity model — better than most frameworks that treat agents as stateless prompt+model pairs.

2. Agent lifecycle management exists and is non-trivial. Token limits, failure tracking, hallucination tracking, turn-scoped lifetimes, handoff with event context windowing, agent self-summary on scope rotation — this is real lifecycle management. Most frameworks don't even attempt it.

3. The adapter abstraction is correct. AgentAdapter as a runtime interface (initialize, process, parse, terminate) with AdapterEntity as a factory — this cleanly separates configuration from runtime. The CLI adapter proves the abstraction works.

4. The interceptor pipeline is well-designed. AgentInterceptor with next() chaining gives you middleware-style extensibility for the invocation path. The TemplateInterceptor shows this working for input transformation.

5. Skills as typed I/O contracts. Input schema + optional template + output schema — skills are essentially typed function signatures for agents. Combined with the reaction pipeline's invoke → map → case → emit flow, this creates a structured data pipeline through the agent.

What's missing for "first-class citizen" status
1. No tool use in the framework.

This is the biggest gap. The AgentChunk type has tool-call and AgentToolCall defined, but there's no framework-level tool execution loop. The AgentAdapter.process() yields chunks and that's it — if the agent requests a tool call, nobody handles it. The adapter must manage the entire tool loop internally.

For agents to be first-class, the framework needs to own tool execution, because:

Tool results produce events (or should). A code execution tool that runs tests should emit TestsExecuted events.
Tool availability is a function of agent state (scope, permissions, context).
Tool calls are auditable side effects — they belong in the event ledger.
Right now, tools are invisible to Ductus. An adapter calls an LLM, the LLM requests a tool, the adapter handles it internally, and Ductus only sees the final text output. No observability, no framework control, no event trail.

2. Only one adapter implementation (CLI).

The CliAgentAdapter is a subprocess adapter — it spawns a process, writes to stdin, reads stdout. This is a valid approach for wrapping existing CLI tools, but there's no SDK/API adapter. No way to talk to OpenAI, Anthropic, or any LLM API directly. Every user must either write their own AgentAdapter implementation or wrap everything in a CLI subprocess.

For agents to be first-class citizens like "controllers in MVC," the framework should ship with at least one direct API adapter that demonstrates the full agent lifecycle (streaming, tool calls, structured output) natively.

3. The reaction pipeline can only invokeAndParse — no streaming.

The reaction pipeline calls dispatcher.invokeAndParse() which collects all chunks, then calls adapter.parse(). The streaming invoke() method exists on the dispatcher but the declarative pipeline doesn't use it. This means:

No progressive output in reactions
No streaming events while the agent is working
No ability to observe or react to intermediate agent output (reasoning, partial text)
The AgentChunkReasoning, AgentChunkToolCall, AgentChunkUsage types exist but are consumed and discarded by invokeAndParse
For agent-first workflows, streaming matters. Long-running agent tasks should produce observable intermediate events.

4. No multi-turn conversation support in the framework.

The AgentContext has messages: AgenticMessage[], but the dispatcher creates a fresh context with only the system message on initialization. There's no mechanism to build up a conversation history across turns. The adapter receives context on initialize(), then each process() call gets an InvocationContext with a prompt string — not a message to append to a conversation.

Multi-turn is entirely the adapter's responsibility. The framework can't introspect, truncate, or manage the conversation window. The maxContextTokens limit exists on the agent entity, but the dispatcher tracks tokensUsed via usage chunks — it doesn't actually truncate or manage the context window, it just replaces the adapter when the limit is hit.

5. No agent-to-agent communication primitive.

Agents can't directly invoke other agents. The reaction pipeline is event → invoke agent → emit event, but there's no agent A delegates to agent B pattern. In real agentic workflows, an orchestrator agent routes to specialist agents, specialists may consult other specialists, etc.

The RequestIntent/ResponseIntent mechanism exists at the processor level, but it's not surfaced to the agent layer. There's no way to express "agent A invokes agent B's skill and gets back the result" within a single reaction or processor without manual wiring.

6. No observability/tracing hooks.

Agent invocations produce no events in the ledger. When the reaction pipeline calls invokeAndParse, the invocation itself is invisible — only the resulting emitted event appears. There's no AgentInvoked, AgentCompleted, AgentFailed, ToolCalled, ToolCompleted event trail. For debugging and auditing agentic workflows, this is essential.

7. Hallucination tracking is declared but not implemented.

AgentEntity has maxRecognizedHallucinations and AgentLifecycleState tracks hallucinations, but nothing ever increments state.hallucinations. The dispatcher increments state.failures on error chunks, but hallucination detection — which the agent builder's JSDoc describes in detail (false claims about checks, mismatched diffs, etc.) — has no implementation path. The assert pipeline step could feed into this, but there's no connection.

Summary table
Aspect	Status	Notes
Agent identity (persona, role, rules)	Strong	Well-modeled, composable, template-driven
Agent lifecycle (scope, limits, handoff)	Functional	Rotation works, handoff context is rich
Adapter abstraction	Sound	Clean factory pattern, extensible
Interceptor pipeline	Sound	Middleware pattern, one implementation
Skill I/O contracts	Good	Typed schemas, template support
Reaction pipeline	Good	invoke/map/assert/case/emit is expressive
Tool use	Missing	Chunk type exists, no framework execution
Streaming in pipelines	Missing	Only invokeAndParse, invoke() unused
Multi-turn conversation	Missing	Adapter-managed, framework-blind
Agent-to-agent invocation	Missing	No primitive for delegation
Built-in API adapters	Missing	Only CLI adapter ships
Observability events	Missing	Invocations are invisible to the ledger
Hallucination tracking	Declared, not wired	Field exists, nothing increments it
My honest take
The event sourcing core — the kernel, multiplexer strategies, backpressure, sequencer, ledger, processors, clusters, concurrent handlers — is genuinely production-grade. It's robust, well-reasoned, and deeply considered.

The agentic layer has the right shape but not yet the right depth. It's an agent-aware framework, not yet an agent-first framework. The distinction: in an agent-first framework, you'd expect tools, multi-turn, streaming, and agent-to-agent delegation to work out of the box with the same declarative quality as Ductus.reaction() and Ductus.processor(). Currently, all of that must be hand-built inside adapter implementations, invisible to the framework.

The good news: the foundation is solid. The AgentInterceptor pipeline, the AgentChunk streaming interface, the AgentAdapter abstraction — these are the right extension points. The gap is not architectural — it's filling in the implementations that make agents truly first-class.

regarding 5 - "No agent-to-agent communication primitive." - I think this is by design - agents should not directly launch or invoke other agents, but only through user-defined event sourcing - that way user manages when agent is allowed to invoke other agents and which - they define reaction of agent a -> emit -> reaction -> emit -> agent b - something like that...



I think we first need to start from designing the outer interfaces - the model of agentic workflow - THEN the implementation follows. what do you think? let's focus first on designing the workflow and perfecting it

You're right on both counts.

On agent-to-agent: that's not a gap, it's a design decision. Direct agent invocation would bypass the ledger, bypass the reducer, bypass user-defined orchestration logic. The event-mediated pattern Agent A → emit → reaction → Agent B is exactly what event sourcing demands. Everything goes through events. The user wires the topology. I retract that point.

On starting from the outer interface: absolutely. Implementation follows shape, not the other way. Let me lay out what I think needs designing, and you tell me where I'm wrong or what I'm missing.

The agentic workflow, as it should look from the outside
An agent invocation in Ductus is a pipeline — it has distinct phases, each with a clear contract. Let me trace through what a complete invocation should look like end-to-end, and identify the interfaces at each boundary.

Phase 1: Trigger
Already done. An event arrives, a reaction's .when() matches, the pipeline starts. No design work needed.

Phase 2: Context Assembly
Before the agent sees anything, the framework assembles the invocation context. Today this is: resolve persona → compose system prompt → validate input against skill schema → render input template → produce prompt string.

Design question: Is the prompt string the right unit of input to the agent?

Currently, the adapter receives InvocationContext.prompt — a single string. This works for the CLI adapter (write to stdin), but for API adapters, you'd want structured messages. The adapter needs to know: is this the first turn? Is this a continuation? What's the conversation history? What tools are available?

The interface boundary here is: what does the framework hand to the adapter at invocation time? Today it's a prompt string. Should it be richer?

Phase 3: Execution (the agent works)
The adapter calls the LLM, the LLM streams back chunks. Today, chunks flow through AgentAdapter.process() as AsyncIterable<AgentChunk>. The chunk types are: reasoning, text, tool-call, error, usage, data, complete.

Design question: Who owns the tool loop?

When the LLM emits a tool-call chunk, someone needs to:

Execute the tool
Feed the result back to the LLM
Let the LLM continue
Today, the adapter must handle this internally. The framework never sees tool calls. Two options:

A. Adapter owns the tool loop — the framework stays out. Tools are adapter/LLM-specific. The framework only sees the final output. Simple, but tools are invisible to the event system.

B. Framework owns the tool loop — the adapter yields a tool-call chunk, the framework executes it (via a registered tool handler), produces a tool result, feeds it back to the adapter, the adapter resumes the LLM. Tools become first-class: the framework can emit events for tool calls, enforce permissions, audit execution.

This is the single biggest design decision for the agentic layer.

Phase 4: Output
The agent produces its final output. Today, adapter.parse(chunks) extracts structured data. Then the reaction pipeline takes over: map → assert → case → emit.

This part works. The map step wraps with trusted metadata, assert validates, case routes, emit commits. Clean.

Design question: Should anything happen between "agent finishes" and "parse"?

Today, all chunks are collected, then parsed. But what if you want to observe the raw output before parsing? Or what if the output schema validation (the skill's output schema) should be a framework concern, not an adapter concern?

Phase 5: Observation
Today: invisible. No events record that an agent was invoked, what it produced, how long it took, how many tokens it used.

Design question: What agent lifecycle events should exist, and should they be durable or volatile?

Candidates:

AgentInvoked — agent X, skill Y, input hash (not full input — could be large)
AgentCompleted — agent X, skill Y, duration, token usage
AgentFailed — agent X, skill Y, error
ToolCalled — tool name, arguments (if framework owns tool loop)
ToolCompleted — tool name, result summary
These could be volatile (broadcast to processors but not persisted) or durable (in the ledger for audit). User's choice per deployment.

What I think needs designing, in priority order
The invocation context contract — what the framework gives the adapter. This shapes everything downstream.
The tool model — framework-owned or adapter-owned, and what the tool interface looks like.
The observation model — which lifecycle events exist and their volatility.
The conversation model — who manages history across turns of the same agent.
Output validation ownership — framework validates against skill output schema, or adapter does.
Where do you want to start? And — do you agree these are the right design boundaries, or do you see it differently?

Phase 2 - it should be richer, yeah. again - feel free to quesiton as much of a current model/design as you feel needed - do not back off one minute. designing the correct interfaces (even if it means we might eventually have to throw some out in the garbage) far outweights clinging to what we have now emotionally. quesiton everything. do not take anythign for granted. if you start your sentence with "currently" - stop, think for a moment - and ask your self "is what currently exists regarding X or Y, actually good"



One important thing: this agentic interfaces were designed far earlier and with FAR less  qualified knowledge (agents are new, event sourcing is old concept) than event sourcing robust approach - so do not AUTOMATICALLY take them with same "trust" as you take event sourcing interfaces.



Phase 3 - processors/framework should own the tool loop, no? extending on the point above - adapter was designed earlier in Ductus infancy. if you think it is bloated, chunky and inflexible - my feelings won't be hurt, on the contrary - I would be happy, because nothing makes ma happier in software engineering than replacing flawed stuff with perfected stuff.



Phase  4: very good point, raw responses should be observable.



Phase 5: also good point, all agentic activity should be translated to events, do you think? regarding volatility - stream chunks should be volatile, final responses durable imo, wdyt?

Good. Full license to question everything. Let me throw away assumptions and think from first principles.

Starting over: What is an agent invocation in an event-sourced system?
It's a side effect — the most complex kind. It's non-deterministic, long-running, streaming, potentially multi-step (tool calls), and it produces structured output that feeds back into events. But fundamentally, from the event sourcing perspective, it's the same as any other processor side effect: event in → work happens → events out.

The agentic layer's job is to make that "work happens" part declarative, observable, and manageable.

The current model's problems (questioning everything)
The Adapter is a huge object
interface AgentAdapter {
initialize(context?: AgentContext): Promise<void>
process(context: InvocationContext): AsyncIterable<AgentChunk>
parse(chunks: AgentChunk[]): any
terminate(): Promise<void>
}
This conflates four different concerns:

Transport — talking to an LLM backend (sending messages, receiving chunks)
Session management — initializing with context, maintaining state, terminating
Output interpretation — parsing chunks into structured data
Conversation ownership — the adapter implicitly owns the message history because initialize receives it and then the framework never touches it again
Why is parse on the adapter? Parsing structured output from text is not a transport concern. The skill defines the output schema — the framework should validate against it. A CLI adapter and an API adapter shouldn't each implement their own JSON extraction logic.

Why does initialize receive the full AgentContext? Because the adapter owns the conversation. But should it? If the framework doesn't own the conversation, it can't truncate, summarize, inspect, or window it. The maxContextTokens limit triggers a nuclear option (replace the entire adapter) instead of context management.

The Dispatcher is also a huge object
AgentDispatcher manages: agent lookup, lifecycle state, prompt composition, template rendering, interceptor pipeline, adapter lifecycle, handoff context, turn tracking. These are all real concerns, but they're tangled into one 520-line class. When something needs to change (like adding tool support), the dispatcher needs surgery.

InvocationContext is a mutable grab-bag
interface InvocationContext {
agentName: string
skillName: string
input: unknown
agentTuple?: AgentTuple
skill?: SkillEntity
prompt?: string
state?: AgentLifecycleState
data: Map<string, any>
}
Interceptors mutate this as it passes through. prompt starts as undefined, the TemplateInterceptor sets it, and if it doesn't, the adapter throws. data is an untyped Map escape hatch. This is implicit coupling through mutation.

The conversation is a black box
AgentContext.messages goes into initialize() and is never seen again. The framework has zero visibility into what the agent's conversation looks like at any point. It can't:

Add tool call/result message pairs
Truncate old messages
Inject new system context mid-conversation
Inspect what the agent "knows"
Tools don't exist
AgentChunkToolCall exists as a type, but there's no tool definition, no tool execution, no tool result handling. If the LLM requests a tool call, the adapter must handle the entire loop internally. The framework is blind to it.

Proposed model: from the outside in
Layer 1: What the user declares (DSL)
// Tools — framework-level, auditable side effects
const RunTests = Ductus.tool('RunTests')
.description('Execute the test suite and return results')
.input(Ductus.object({ path: Ductus.string() }))
.execute(async (input, { getState, use, emit }) => {
const runner = use(TestRunner)
const result = await runner.run(input.path)
emit(TestsExecuted({ path: input.path, ...result }))
return result
})
// Skills — typed I/O contracts (unchanged, they're good)
const ImplementSkill = Ductus.skill('implement')
.input(Ductus.object({ task: Ductus.string() }), 'implement.mx')
.output(Ductus.object({
code: Ductus.string(),
files: Ductus.array(Ductus.string())
}))
// Agents — identity + capabilities + constraints
const Engineer = Ductus.agent('engineer')
.role('Senior Software Engineer')
.persona('...')
.skill(ImplementSkill)
.tool(RunTests)
.tool(ReadFile)
.maxContextTokens(100_000)
.handoff({ reason: 'overflow', template: 'handoff.mx' })
// Workflows — event-driven orchestration (unchanged, it's good)
Ductus.reaction('implement')
.when(TaskAssigned)
.invoke(Engineer, ImplementSkill)
.map((output, ctx) => ({ ...output, actor: ctx.agent.name }))
.emit(ImplementationCompleted)
The key addition: .tool() on agents. Tools are declared at the framework level, attached to agents, and the framework manages their execution during invocations.

Layer 2: What happens during an invocation (contracts)
When the reaction pipeline hits .invoke(Engineer, ImplementSkill), the framework runs this sequence:

1. CONTEXT ASSEMBLY
   ├── Compose system message (persona + rules + systemPrompt)
   ├── Build user message (skill input → template → message)
   ├── Collect conversation history (framework-managed)
   └── Gather available tools (from agent definition)
   ↓
2. TRANSPORT
   ├── Send messages + tool definitions to LLM backend
   └── Receive streaming chunks
   ↓
3. AGENT LOOP (may repeat if tools are called)
   ├── Stream chunks → emit volatile observation events
   ├── If tool-call chunk:
   │   ├── Emit ToolRequested event (volatile)
   │   ├── Execute tool via registered handler
   │   ├── Emit ToolCompleted event (volatile or durable)
   │   ├── Add tool result to conversation
   │   └── Send updated conversation to transport → back to streaming
   └── If complete: exit loop
   ↓
4. OUTPUT
   ├── Extract structured data from response
   ├── Validate against skill's output schema
   └── Return validated result to pipeline
   ↓
5. OBSERVATION
   ├── Emit AgentCompleted event (durable) with usage stats
   └── Update lifecycle state (tokens, turns)
   Layer 3: The transport interface (what adapter authors implement)
   The adapter should be radically simpler:

interface AgentTransport {
send(request: TransportRequest): AsyncIterable<AgentChunk>
close(): Promise<void>
}
interface TransportRequest {
messages: AgenticMessage[]
tools?: ToolSchema[]        // JSON schema definitions for LLM function calling
outputFormat?: 'text' | 'json'
model: string
temperature?: number
}
That's it. No initialize, no parse, no lifecycle. A transport is a pipe: messages in, chunks out. The framework owns everything else.

API adapters (OpenAI, Anthropic): send the full message history each time. Stateless.
CLI/subprocess adapters: receive the full history, extract what they need (e.g., last user message), manage their internal state. The close() method terminates the process.
The framework never needs to know if the transport is stateful or stateless.

Layer 4: Conversation ownership
The framework manages the conversation:

ConversationState {
systemMessage: string
messages: AgenticMessage[]    // user, assistant, tool-call, tool-result
totalTokens: number           // estimated or reported
}
On each invocation:

Framework adds the user message (rendered from skill input)
Framework calls transport.send(allMessages, tools)
As chunks arrive, framework builds the assistant response
If tool calls occur, framework adds tool call + result messages
When complete, framework adds the full assistant message to history
Framework updates token count
When maxContextTokens is reached, the framework has options:

Truncate — remove oldest messages (keep system + last N)
Summarize — ask the agent to summarize, replace history with summary
Handoff — current behavior, replace the adapter entirely
These could be configurable strategies, similar to multiplexer strategies.

Key design decisions I need your input on
1. Tools: per-agent or per-skill?

I showed .tool() on the agent. But should tools be per-skill instead? An agent might have different tools available depending on which skill is invoked. Alternatively: tools on agent (the agent's toolbox), with optional skill-level overrides.

2. Observation events: who emits them?

Should the framework automatically emit AgentInvoked, AgentCompleted, ToolRequested, ToolCompleted events? Or should the user opt into this? If automatic, they flow through the multiplexer and all processors see them.

Your instinct — stream chunks volatile, final responses durable — is correct as a default. But should the framework emit these automatically, or should the user wire them explicitly?

3. parse is gone from the adapter — who extracts structured output?

If the LLM supports JSON mode / structured output, the transport can request it via outputFormat: 'json'. The framework then does JSON.parse + schema validation. If the LLM doesn't (plain text), the framework needs a configurable extraction strategy (regex for JSON blocks, or something smarter). Should this be a per-skill configuration?

4. Does the current AgentChunk type cover what we need?

The chunk types are: reasoning, text, tool-call, error, usage, data, complete. With tool calls now framework-managed, we might also need tool-result as a chunk type (so the transport can yield tool results if it handles tools natively, like some APIs do). Or does the framework fully own tool execution and the transport never sees tool results?

Where do you want to start?

Layer 1:



1. I love the Ductus.tool interface. looks good.



2. skills do look good today, but we might want to add some mapping and validation layer, no? currently skills only ensure structural integrity and typesafety, but they do not ensure that the data, even though structurally valid, is actually a solid data or garbage. When human has a skill to do something, let's say play a piano, they do not only make appearance of playing a piano, but actually play it verifiable by their own and other ears. this is a rigid analogy, but you get the idea, right?



3. regarding agents - you are right that currently reaching/exceeding "maxContextToken"-s  means complete replacement - this might be desirable for some developers, but unwanted for others, it should be policy-dependend (similar to how we have scaling policy for dynamic clusters), right? what else?



4.Reactions are one of my biggest "hmmm...."-s - they look okay-ish, but are they as robust as they try to appear, or are they very specific and rigid?



Layer 2:

no comment here, looks fine.



just a question - how would processors consume stream chunks and alike? not sure if this question belongs here





Layer 3:

that's it?  should each TransportRequest contain ALL messages so far? even for CLI-based agents - or are we defining most abstract interface which both API and CLI can consume? like API gets those messages, CLI only gets the last one - something like that?



Layer 4: right



Now answers:



1. I think both, or is it an overkill? Agent might have some generic tools (unskilled labor) -  for example _ file read+file write, etc



and skills - specific tools. what do you think?



2. can we opt-in to specific events that we want to be emitted DECLARATIVELY? like having some fluent method where we provide an array of Ductus-provided agentic EventDefinitions - we want to receive, and optionally a method that lets us catch all events without listing them individually. something like this comes to mind, but feel free to challenge me on this and any matter



3. I think we can agree that skill-related responses should always be JSON-s no? I mean Zod defines json schema, not markdown, not xml... would there be benefit to allow other languages/schemas? if there would, we can discuss this further

regarding where parsing should happen - what do you think?

4. we do need tool-result

Let me take these one at a time.

Skill validation layer (Point 2)
You're right. Structural integrity (Zod schema) is necessary but not sufficient. An agent can return { testsRun: true, allPassing: true } that matches the schema perfectly — and be lying.

The assert step in the reaction pipeline addresses this, but it has a problem: it's per-reaction, not per-skill. If ImplementSkill is used in three different reactions, you duplicate the validation logic three times. If a skill ALWAYS requires certain validation (code compiles, tests actually ran, files actually exist), that validation belongs on the skill.

Proposal:

const ImplementSkill = Ductus.skill('implement')
.input(Ductus.object({ task: Ductus.string() }), 'implement.mx')
.output(Ductus.object({
code: Ductus.string(),
files: Ductus.array(Ductus.string())
}))
.validate(async (output, { use, getState }) => {
const fs = use(FileSystem)
for (const file of output.files) {
if (!await fs.exists(file)) {
throw new Error(`Claimed file ${file} does not exist`)
}
}
})
Skill-level .validate() runs automatically after every invocation of this skill, regardless of which reaction triggered it. It runs AFTER schema validation (structural) and BEFORE the pipeline continues (so map, assert, case, emit all receive validated data).

The reaction's .assert() remains for reaction-specific validation that doesn't belong on the skill.

This also opens a design question: what happens when validation fails? Today, .error() catches it. But a more natural agentic pattern is retry with feedback — send the error back to the agent and let it try again. This could be a skill-level config:

.validate(...)
.maxRetries(3)  // on validation failure, feed error back to agent, retry
The framework handles the retry loop internally: invoke → validate → fail → add error as user message → re-invoke → validate → pass. Transparent to the reaction.

Agent context management policy (Point 3)
You're right — replacement is ONE policy. The framework should support multiple strategies, similar to multiplexer strategies:

Replace (current) — terminate adapter, create fresh one with handoff context
Truncate — remove oldest messages, keep system + last N
Summarize — ask the agent to summarize its conversation, replace history with the summary message, continue with the same adapter
Sliding window — keep the last N tokens worth of messages, always
These could be:

Ductus.agent('engineer')
.maxContextTokens(100_000)
.contextPolicy('summarize')  // or 'replace', 'truncate', 'sliding-window'
Or for full control:

.contextPolicy(Ductus.contextPolicy.summarize({
targetTokens: 50_000,    // summarize down to this
preserveSystem: true,
preserveLastN: 5,
}))
What else about agents? A few things I think need design:

Model placement. Currently model is separate: flow.agent(Engineer, Model, Adapter). But what if an agent should use different models for different skills? Cheap model for simple tasks, expensive model for complex ones. Should model be attachable per-skill?

Ductus.agent('engineer')
.skill(ImplementSkill, { model: Ductus.model('claude-4-opus') })
.skill(ReviewSkill, { model: Ductus.model('claude-4-sonnet') })
.defaultModel(Ductus.model('claude-4-sonnet'))
Transport placement. Same question. Currently the adapter is at the flow level. But if models are per-skill, transports might need to be per-model-provider. Or is transport always one-per-agent?

Reactions: honest assessment (Point 4)
Reactions are good for linear, single-agent, single-invocation workflows. That covers a lot of use cases. But let me be honest about what they can't do:

Can't retry with feedback. If the agent produces bad output, the only options are .error() (transform and continue) or let it throw (kill the pipeline). You can't say "try again." This is the most common agentic pattern, and reactions don't support it. The skill-level .maxRetries() I proposed above would fix this at the skill layer.

Can't conditionally select agents. You can't say "if priority is high, invoke SeniorEngineer; else invoke JuniorEngineer." You'd need two reactions with different .when() filters, or a processor.

Can't invoke multiple agents. No parallel invocation, no sequential chaining of different agents within one reaction. If you need Agent A's output to feed Agent B, that's two reactions mediated by an event. This is correct for event sourcing — but it means a 3-agent pipeline requires 3 reactions + 2 intermediate events. Verbose but auditable.

Can't observe streaming. The reaction calls invokeAndParse — it blocks until the agent finishes. No progressive output.

My take: reactions should stay simple. Don't add loops, branches, or parallel invocations to reactions. Those should be expressed through events (that's the whole point of event sourcing). The ONE thing to add is retry — and that belongs on the skill, not the reaction.

The thing that DOES make reactions more powerful is the tool loop. When the framework owns tool execution, a single .invoke() step can do significantly more work (agent calls tools, tools emit events, tools produce results, agent continues) — all invisible to the reaction's pipeline. The reaction still looks linear, but the invocation internally is as complex as it needs to be.

How processors consume stream chunks (Layer 2 question)
Through events. When the framework invokes an agent, it can emit volatile events:

AgentStreamChunk({ agent: 'engineer', skill: 'implement', chunk: { type: 'text', content: '...' } })
These flow through the multiplexer like any other event. Any processor can subscribe:

Ductus.processor('StreamLogger', async function* (events) {
for await (const event of events) {
if (AgentStreamChunk.is(event)) {
console.log(`[${event.payload.agent}] ${event.payload.chunk.content}`)
}
}
})
The invoking reaction doesn't see these — it only gets the final parsed result. But observation processors see everything. This keeps reactions simple while making agent execution observable.

Transport: full messages always (Layer 3)
Yes. TransportRequest.messages always contains the full conversation history. The transport decides how to use it:

API transport: sends all messages (API is stateless)
CLI transport: extracts the last user message, writes to stdin (process is stateful)
Hybrid: whatever the implementation needs
The framework doesn't need to know. The contract is: "here's everything the agent should know." The transport is responsible for translating that into whatever the backend expects.

Answers to your answers
1. Tools: both agent-level and skill-level. Agreed. No overkill — it's a simple merge:

Available tools for invocation = agent.tools ∪ skill.tools
Agent tools are the generic toolbox (file I/O, shell). Skill tools are task-specific (RunTests for implement, not for review). Clean separation.

2. Declarative observation opt-in. I like your instinct. Let me propose the interface:

Ductus.agent('engineer')
.observe(Ductus.events.AgentCompleted)                          // volatile by default
.observe(Ductus.events.ToolCompleted, { volatility: 'durable' }) // override to durable
.observeAll()                                                    // everything, volatile
.observeAll({ volatility: 'durable' })                          // everything, durable
On the agent, not the reaction. Because observation is about the agent's behavior, not the workflow. If Engineer has .observe(AgentCompleted), then EVERY invocation of Engineer — regardless of which reaction triggered it — emits AgentCompleted.

The framework ships a set of well-known Ductus.events.* definitions. Users don't define these — they're framework-provided. Users just pick which ones they want.

3. Output is always JSON. Agreed. Skills define Zod schemas. Output is structured data. The framework:

Collects all text chunks from the agent response
Extracts JSON (if transport used JSON mode, it's already JSON; if not, extract from text)
Validates against skill's output schema
Returns typed result
Parsing happens in the framework, between transport and pipeline. Not in the adapter. The transport's job is to get text out of the LLM. The framework's job is to make that text into typed data.

The extraction strategy could be configurable per skill if needed (regex, JSON mode, XML-to-JSON, etc.), but the default (JSON mode if available, regex extraction as fallback) covers 95% of cases.

4. tool-result chunk type. Added to the model. The chunk vocabulary becomes:

Chunk	Direction	Meaning
reasoning	LLM → framework	Model's chain-of-thought
text	LLM → framework	Output text
tool-call	LLM → framework	Model requests tool execution
tool-result	framework → LLM	Framework returns tool execution result
usage	LLM → framework	Token usage report
error	either direction	Something went wrong
data	LLM → framework	Structured data (if transport supports it natively)
complete	LLM → framework	Generation finished
What should we refine next?

1. excellent suggestion and demonstration of .validate method.

just a quesiton, why .validate and not .assert? genuine question, no subtext.

.maxRetries looks good, but how is it going to be handled?

For example, agent builder has maxFailures and maxRecognizedHallucinations already, how skill maxRetries would be different? genuine and open-ended question

we might also want to consider and discuss adding of .transform/.map method on skill - what do you think?



also, should skills have side-effects of their own? like should developer be able to define, let's say emission of some event from skill or would it be too much?  maybe this is too much...



2. very good. I love contextPolicy - both string approach and full-control approach, I think we should support both. so context policy is going to be interface and have implementations, right?



regarding models - looks promising - should Agent own skill-level models and decide which skills gets what or should skill own their models and let agents override them if they want to?



regarding transports -same - absolutely they should be configurable per agent/per skill. but who owns what?



3. regarding reactions - I understand their limitations - should we try to make them more robust and cover morse cases?  allow "try-again"-s, context-dependend invokation of agents, ability to invoke multiple agents?



Layer 2:

very good





Layer 3:

I understand why LLM API-s design their apis stateless, I do, maintaining internal history could be devastating for them. but why should not we keep conversation in some internal state (not domain state that is getState) and only pass latest messages? that way new instances of LLM-s or API-based llm-s could retrieve all messages, while CLI-based adapters stay thin.. I MIGHT be missing something that defats my argument, feel free to challenge me



Appreciations to your answers to my answers:



1. tools-merge: very good



2. I love it. very good. similarly should we able to define observe-s of  Skill events (Skill invoked, skill success, skill error, skill retry, stuff like that) on skills AND by extension on agents?

3. should I keep using Zod or implement my own schema library?

4. good

These are all excellent design questions. Let me work through each one carefully.

.validate() vs .assert() on skills
No good reason for a different name. .assert() is consistent with the reaction pipeline vocabulary, and it communicates "throws on failure" more clearly than .validate() (which sounds like it might return boolean). Use .assert().

Ductus.skill('implement')
.output(schema)
.assert(async (output, { use }) => { ... })
.maxRetries(3)
maxRetries vs maxFailures vs maxRecognizedHallucinations
These operate at different scopes:

Concern	Scope	What happens
maxRetries	per-invocation (skill)	Output fails validation → send error as feedback → agent tries again → still fails → invocation fails
maxFailures	per-agent-lifetime	Count of failed invocations across all skills → triggers handoff/replacement
maxRecognizedHallucinations	per-agent-lifetime	Count of detected fabrications → triggers handoff/replacement
The flow is sequential: skill retries exhaust first, then agent lifetime counters increment.

invoke agent with skill
→ output fails assertion
→ retry 1 (send error back as feedback)
→ output fails again
→ retry 2
→ output passes → success, agent.failures unchanged
OR
→ retry 3 (maxRetries exhausted)
→ invocation FAILS
→ agent.failures++
→ if agent.failures >= maxFailures → replace agent (handoff)
Retries are about giving the agent a chance to self-correct within one task. Failures are about recognizing a fundamentally broken agent that needs replacement.

.transform() / .map() on skills
I'd advise against it. Skills should be contracts — they define what goes in and what comes out. .assert() verifies the output is honest. .map() would change the output shape, which means the skill's output schema no longer describes what downstream consumers receive.

If the same transform needs to happen for every invocation of a skill, extract it into a function and call it in the reaction's .map():

const normalizeImplementOutput = (output, ctx) => ({ ...output, actor: ctx.agent.name })
// Reaction A
.invoke(Engineer, ImplementSkill).map(normalizeImplementOutput).emit(...)
// Reaction B  
.invoke(Engineer, ImplementSkill).map(normalizeImplementOutput).emit(...)
One line of reuse. The skill stays pure.

Skill side effects (emissions)
Too much. I agree with your instinct. Skills are contracts, not workflows. If a skill's output should trigger events, the reaction pipeline does that. If tools should emit events during execution, the tool's .execute() does that. Skills define the interface; reactions and tools define the behavior.

Context Policy (Point 2)
Yes — interface with implementations. Same pattern as multiplexer strategies and scaling policies:

interface ContextPolicy {
apply(
conversation: ConversationState,
limit: number,
transport: AgentTransport,
): Promise<ConversationState>
}
The transport parameter is needed for SummarizePolicy — it needs to invoke the LLM to produce a summary. The other policies don't use it.

Implementations: ReplaceContextPolicy, TruncateContextPolicy, SummarizeContextPolicy, SlidingWindowContextPolicy.

String shortcuts map to default-configured implementations:

.contextPolicy('summarize')  // = new SummarizeContextPolicy()
.contextPolicy(new SummarizeContextPolicy({ targetTokens: 50_000, preserveLastN: 5 }))
Model ownership
Agent owns, skill doesn't. A skill is a job description — "take this input, produce this output." It doesn't care what model runs it. Different agents might use different models for the same skill based on their capability tier:

const SeniorEngineer = Ductus.agent('senior-engineer')
.defaultModel(Ductus.model('claude-4-opus'))
.skill(ImplementSkill)
const JuniorEngineer = Ductus.agent('junior-engineer')
.defaultModel(Ductus.model('claude-4-sonnet'))
.skill(ImplementSkill)  // same skill, cheaper model
For per-skill model override within one agent:

Ductus.agent('engineer')
.defaultModel(Ductus.model('claude-4-sonnet'))
.skill(ImplementSkill, { model: Ductus.model('claude-4-opus') })   // expensive skill
.skill(ReviewSkill)                                                  // uses default
The hierarchy: **skill

resume. you were cut off

Picking up from where I was cut off — I was mid-sentence on model ownership hierarchy.

Model and Transport ownership (continued)
The hierarchy: skill has no opinion → agent provides default → agent overrides per-skill.

Ductus.agent('engineer')
.defaultModel(Ductus.model('claude-4-sonnet'))
.defaultTransport(Ductus.transport.anthropic({ apiKey: '...' }))
.skill(ImplementSkill, {
model: Ductus.model('claude-4-opus'),           // override model for this skill
})
.skill(ReviewSkill)                                 // uses defaults
Transport follows the same pattern. Usually one transport per agent (all skills use the same backend). But if one skill needs a different provider:

.skill(ImageAnalysisSkill, {
model: Ductus.model('gpt-4o'),
transport: Ductus.transport.openai({ apiKey: '...' }),
})
This removes model and transport from flow.agent(Engineer, Model, Adapter) and puts them on the agent where they belong. The flow just registers agents:

Ductus.flow()
.agent(Engineer)
.agent(Reviewer)
.reaction(ImplementReaction)
.reaction(ReviewReaction)
Cleaner. The agent is self-contained — it knows its identity, capabilities, constraints, AND infrastructure.

Should reactions be more robust? (Point 3)
My position: not yet. Here's why.

The gaps you're feeling — retries, conditional agents, multi-agent invocations — are real. But two of the three are better solved elsewhere:

Retries: Solved by skill-level .maxRetries() + the tool loop. The framework retries automatically within .invoke(). The reaction stays linear.

Conditional agent selection: This is orchestration logic. In event sourcing, orchestration goes in processors, not in declarative pipelines. If you need "if priority=high, use SeniorEngineer," write a processor or use two reactions with different .when() predicates. Making reactions conditionally select agents turns them into imperative code wearing declarative clothes.

Multi-agent invocations: Agent A → emit event → Agent B is the event-sourced way. Yes, it's verbose (two reactions + one intermediate event), but it's auditable — every intermediate step is in the ledger. If we allow .invoke(A).invoke(B) in a single reaction, the intermediate result between A and B is invisible to the ledger.

However, I'd revisit this after the tool loop, skill retries, and observation events are implemented. If real-world workflows still feel painful with reactions, then we extend. Don't add complexity preemptively.

Conversation state and transport interface (Layer 3)
You raise a fair point. Let me think about it honestly.

Your argument: the framework keeps the conversation; stateless transports get everything; stateful transports only get new messages.

My concern was: how does the transport know which messages are new? But the framework knows — it manages the conversation. So the framework can tell the transport.

Clean approach:

interface TransportRequest {
messages: AgenticMessage[]     // full conversation history
newFromIndex: number           // messages[newFromIndex:] are new since last send
tools?: ToolSchema[]
model: string
temperature?: number
}
API transports (stateless): use messages — send everything to the LLM.
CLI transports (stateful): use messages.slice(newFromIndex) — only write new messages to stdin.
Either can access the full history if needed.
No mode declaration. No "stateful vs stateless" flag. The transport has all the information and decides how to use it. The framework always provides the full picture.

Your instinct is right — the framework should own the conversation state. I was overcomplicating it by trying to make the transport stateless. The newFromIndex field is the bridge that makes both modes work.

Observation events on skills AND agents (Point 2 continued)
Yes. Two levels of observation:

Skill-level events:

SkillInvoked — skill X invoked with input (hash, not full payload)
SkillCompleted — skill X completed, duration, output schema validated
SkillFailed — skill X failed after exhausting retries
SkillRetry — skill X output rejected, retrying (attempt N of M)
Agent-level events:

AgentInvoked — agent X started working
AgentCompleted — agent X finished, token usage
AgentFailed — agent X invocation failed
AgentReplaced — agent X hit lifetime limit, replaced via handoff
ToolRequested — agent X requested tool Y
ToolCompleted — tool Y returned result
AgentStreamChunk — raw streaming chunk (for real-time observation)
Declaration:

// On skill — applies to every invocation of this skill
Ductus.skill('implement')
.observe(Ductus.events.SkillRetry)  // only emit retry events
// On agent — applies to all invocations of this agent
Ductus.agent('engineer')
.observe(Ductus.events.AgentCompleted, Ductus.events.ToolCompleted)
.observeSkills(Ductus.events.SkillFailed)  // for all skills on this agent
// Catch-all
.observeAll()                        // everything, volatile
.observeAll({ volatility: 'durable' }) // everything, persisted to ledger
Skill observations merge with agent observations. If the skill says "observe SkillRetry" and the agent says "observeAll," the result is "all events for this agent, including SkillRetry."

Zod vs own schema library (Point 3)
Keep Zod. But keep it behind your facade.

Building a schema library from scratch is a multi-month effort to reach parity with what Zod gives you today: runtime validation, TypeScript inference, error messages, JSON Schema generation (you need this for LLM tool calling), transforms, refinements, discriminated unions. Rolling your own means maintaining all of that.

What you already have is the right architecture:

// Users write this:
Ductus.object({ title: Ductus.string(), count: Ductus.number() })
// Internally, these are Zod wrappers
Your Schema interface is the abstraction boundary. Users never import from zod directly — they use Ductus.* schema methods. If you ever need to swap Zod for something else, you change the implementation of Ductus.object(), Ductus.string(), etc. The user-facing API doesn't change.

The one thing to verify: check that your Schema interface doesn't leak Zod types. If Schema is literally zod.ZodType, users' code will depend on Zod transitively. If Schema is your own interface that wraps Zod, you're insulated.

Let me check.

There it is. Schema = ZodSchema. This means Zod is leaked directly into your public API. Every interface that uses Schema (SkillEntity, CaseStep, ReducerBuilder, etc.) exposes Zod as a public dependency.

For now this is fine — it works. But if you want future-proofing, wrap it:

export interface Schema {
parse(data: unknown): unknown
safeParse(data: unknown): { success: boolean; data?: unknown; error?: unknown }
toJsonSchema(): Record<string, unknown>  // needed for LLM tool calling
}
Then Ductus.object(), Ductus.string(), etc. return objects that implement this interface using Zod internally. Users never see ZodSchema. You can swap implementations without breaking the public API.

But — this is a refactor you can do later. It's not blocking anything today. The design decisions we're making now (skills, tools, observations) don't depend on which schema library is underneath.

Where do you want to go next? We've designed the outer shape of: tools, skill validation + retries, context policies, model/transport ownership, observation events, and the transport interface. The pieces I see still needing design are:

The tool entity and builder — what does Ductus.tool() look like internally?
The full invocation sequence — detailed step-by-step of what happens inside .invoke(), including the tool loop and retry loop
The framework-provided event definitions — exact shapes of Ductus.events.AgentCompleted, ToolRequested, etc.
The refactored AgentDispatcher — breaking the huge object into focused components
1. assert() agreed

2. clear

3. absolutely agreed. skills remain contracts

4. agreed - side effects are too much in skills



Point 2

good



Model Ownership:

agreed - agents own models



Transport ownership  - agreed.



Regarding removing model and transport from flow - this is where I struggle a bit - what if we want to reuse same agent in different model+transport contexts? or maybe I'm thinking of non-realistic scenario...



Point 3 - agreed.



Layer 3- so you insist we still pass full list of messages to transport instead of transport extracting those messages from internal state when needed?



Point 2 continued - so skills also define observations? does not that break contract mental model?

OR agent declares which skill levels it wants to consume? or both?



regarding zod - I agree.

Reusing agents with different model+transport
Not a non-realistic scenario at all. Very real: dev vs prod, different model tiers for different environments, A/B testing models.

The tension is: if model/transport live on the agent, the agent becomes environment-specific. If they live on the flow, the agent stays a pure identity.

I think the answer is both layers, with override semantics:

// Agent declares its DEFAULTS (what it prefers)
const Engineer = Ductus.agent('engineer')
.role('Senior Software Engineer')
.persona('...')
.skill(ImplementSkill)
.defaultModel(Ductus.model('claude-4-sonnet'))
.defaultTransport(Ductus.transport.anthropic({ apiKey: '...' }))
// Flow can OVERRIDE at registration (composition root)
Ductus.flow()
.agent(Engineer)                                              // uses agent's defaults
.agent(Engineer, { model: Ductus.model('claude-4-opus') })    // override model
.agent(Engineer, { transport: Ductus.transport.cli(...) })     // override transport
This is dependency injection. The agent declares what it needs (defaults). The flow — the composition root — can override for the deployment context. Agent identity stays reusable. Infrastructure is configurable at the wiring site.

If the agent has NO defaults, the flow MUST provide them:

const Engineer = Ductus.agent('engineer')
.skill(ImplementSkill)
// no defaultModel, no defaultTransport
Ductus.flow()
.agent(Engineer, { model: ..., transport: ... })  // required here
This keeps agent definitions environment-agnostic when needed, while allowing self-contained agents when convenient.

Per-skill model overrides stay on the agent (since they're about the agent's resource allocation strategy, not the environment):

const Engineer = Ductus.agent('engineer')
.defaultModel(Ductus.model('claude-4-sonnet'))
.skill(ImplementSkill, { model: Ductus.model('claude-4-opus') })  // agent decides this skill needs more power
Layer 3: Why I insist on passing messages to transport
Your instinct — transport reads from internal state — has a coupling problem.

If the transport holds a reference to a conversation manager, it's coupled to a framework-internal abstraction. Testing a transport means mocking that abstraction. Swapping conversation implementations means ensuring transport compatibility. The transport is no longer a simple pipe — it's a participant in state management.

Passing messages directly keeps the transport pure: input in, chunks out. No references to framework internals. Easy to test (construct a TransportRequest, assert on output). Easy to implement (no framework knowledge needed — a transport author only needs to know the request/response shapes).

The newFromIndex approach gives the transport everything without coupling:

interface TransportRequest {
messages: AgenticMessage[]   // full history, always
newFromIndex: number         // "everything before this index, you've seen before"
tools?: ToolSchema[]
model: string
temperature?: number
}
An API transport ignores newFromIndex and sends messages. A CLI transport does messages.slice(newFromIndex) and writes to stdin. Both are simple. Neither knows about conversation management.

The cost is: passing the full array reference on every call. But it's a reference — not a copy. The memory is the same conversation array the framework already holds. Zero overhead.

If you find a concrete case where this doesn't work, I'll reconsider. But "the transport pulls from state" adds coupling that I don't think pays for itself.

Skill observations and the contract mental model
You're right to question this. Observations don't belong on skills. Skills are contracts.

A skill says: "I accept this input and produce this output." Whether someone monitors the invocation is an operational concern, not a contractual one. It's like the difference between a function signature and the monitoring dashboard that watches it.

Agent-only observation. Agent declares what to observe, including per-skill granularity:

Ductus.agent('engineer')
// Agent-level events
.observe(Ductus.events.AgentCompleted)
.observe(Ductus.events.AgentReplaced, { volatility: 'durable' })

// Skill-level events, configured on the agent
.observeSkills(Ductus.events.SkillCompleted)                       // all skills
.observeSkill(ImplementSkill, Ductus.events.SkillRetry)            // specific skill

// Tool-level events
.observe(Ductus.events.ToolCompleted, { volatility: 'durable' })

// Everything
.observeAll()
The agent says: "when I work, emit these signals." The skill stays pure. The observation configuration is part of the agent's operational profile — alongside maxContextTokens, contextPolicy, maxFailures, etc.

This also means: the same skill used by two different agents can have different observation configurations. SeniorEngineer might have .observeAll() for debugging. ProductionEngineer might only have .observe(Ductus.events.AgentCompleted) to reduce noise. The skill doesn't care.

So the refined design summary at this point:

Concept	Owns	Doesn't own
Skill	I/O schemas, assertion, maxRetries	Model, transport, tools, observations, transforms
Agent	Identity, persona, rules, skills, tools, observations, lifecycle limits, context policy	—
Flow	Agent registration, model/transport overrides, reducers, reactions, processors	Agent identity
Tool	Name, description, input schema, execute function	—
Reaction	Event wiring, pipeline (invoke → map → assert → case → emit)	Retry logic (delegated to skill), tool loop (delegated to framework)
What's next?

agreed on all points. and regarding transport - if we pass REFERENCE of the conversation - then I'm fine, but to make it even clearer and even safer - maybe we should introduce an immutable data structure with structural sharing for maintaining conversations AND passing safe reference while being confident we do not get unexpected mutations??



regarding skills - agreed. also .observeSkill(ImplementSkill) - all ImplementSkill-skill related events

Immutable conversation with structural sharing
Good instinct. The concern is real: if the framework holds a conversation and passes a reference to the transport, nothing prevents the transport from mutating it (pushing messages, splicing, etc.). Even if you "trust" your own transport implementations, a third-party transport could corrupt framework state.

The design:

class Conversation {
private constructor(
private readonly system: string,
private readonly _messages: readonly AgenticMessage[],
private readonly _tokenEstimate: number,
) {}
static create(systemMessage: string): Conversation {
return new Conversation(systemMessage, [], 0)
}
append(message: AgenticMessage): Conversation {
return new Conversation(
this.system,
[...this._messages, message],
this._tokenEstimate + estimateTokens(message),
)
}
get messages(): readonly AgenticMessage[] { return this._messages }
get systemMessage(): string { return this.system }
get tokenEstimate(): number { return this._tokenEstimate }
get length(): number { return this._messages.length }
}
Every operation returns a new Conversation. No mutation methods exist. The transport receives a Conversation reference and literally cannot corrupt it — there's nothing to call.

The transport request becomes:

interface TransportRequest {
conversation: Conversation    // immutable, safe to pass
newFromIndex: number
tools?: ToolSchema[]
model: string
temperature?: number
}
The transport reads conversation.messages (returns readonly array) and does what it needs. Can't push, can't splice, can't reassign.

On structural sharing specifically: for conversations, the practical question is whether [...oldMessages, newMessage] (O(n) copy) is a problem. A very long agent conversation might have 500 messages. Copying 500 references is ~microseconds. Tool loops add a few messages per round. Even with 10 tool rounds, that's 520 copies of 520 references.

True structural sharing (persistent vector, trie-based) would make appends O(1) instead of O(n). But the constant factor is so small for conversation-sized data that the engineering complexity isn't justified today. If conversations ever grow to tens of thousands of messages (unlikely — token limits prevent this), we can swap the internal representation without changing the external Conversation interface.

So: immutable API now, simple array copy internally, persistent data structure later if needed. The interface is the same either way.

.observeSkill(ImplementSkill) as "all events for this skill"
Clean. No arguments = all skill-level events. With arguments = only the specified ones.

Ductus.agent('engineer')
.observeSkill(ImplementSkill)                             // all events for this skill
.observeSkill(ReviewSkill, Ductus.events.SkillFailed)     // only failures for this skill
.observe(Ductus.events.AgentCompleted)                    // agent-level
.observeAll()                                             // everything
The mental model: .observeSkill(skill) is the skill-scoped version of .observeAll(). When you name a skill without specifying events, you're saying "I want full visibility into this skill."

Should we move to designing the tool entity and the full invocation sequence next? The tool model feels like the next critical piece — it determines how the framework owns the tool loop, which is the core of making agents genuinely first-class.
