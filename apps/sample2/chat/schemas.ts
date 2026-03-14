import D from 'ductus'

export const ExploreInput = D.object({
  request: D.string(),
})

export const ExploreOutput = D.object({
  codebaseOverview: D.object({
    architecture: D.string()
      .describe('High-level architectural description of the codebase inferred from actual code. Name specific patterns (e.g. MVC, layered architecture, monorepo). Never generic.'),
    techStack: D.array(D.string())
      .describe('Every technology, framework, and library found in the codebase. Inferred from package.json, imports, config files. Exact names and versions where visible.'),
    conventions: D.array(D.string())
      .describe('Observed conventions across the codebase — file organization, module boundaries, naming patterns. Each entry must be a specific observation, not a guess.'),
  }),
  relevantModules: D.array(D.object({
    path: D.string()
      .describe('Exact file or directory path as it exists in the codebase. Never approximate or invent.'),
    responsibility: D.string()
      .describe('What this module does, inferred from its actual code — not its filename. One specific sentence.'),
    relevanceReason: D.string()
      .describe('Why this module is relevant to THIS specific feature request. Must reference both the request and something specific found in the module.'),
  })),
  existingSolutions: D.array(D.object({
    path: D.string()
      .describe('Exact path of the file that already addresses part of the feature request.'),
    description: D.string()
      .describe('What exactly this file already implements that relates to the request. Reference specific functions, logic, or patterns found — not just the file\'s general purpose.'),
  })),
  conflictZones: D.array(D.object({
    path: D.string()
      .describe('Exact path of the file that may conflict with or be affected by the feature.'),
    description: D.string()
      .describe('Exactly why this file is a conflict zone — what specific logic, dependency, or pattern creates the risk. Never vague.'),
    severity: D.enum(['low', 'medium', 'high'])
      .describe('low: minor friction, easy to work around. medium: requires careful coordination. high: likely to break existing behavior if not handled explicitly.'),
  })),
  unexpectedDependencies: D.array(D.object({
    path: D.string()
      .describe('Exact path of the dependency discovered outside the initial inference scope.'),
    description: D.string()
      .describe('What this file does and what was found in it that was unexpected.'),
    relevanceReason: D.string()
      .describe('Why this unexpected dependency matters for the feature request. What risk or consideration does it introduce.'),
  })),
  openQuestions: D.array(D.object({
    question: D.string()
      .describe('A specific question that arose from reading the code that cannot be answered from the code alone. Must be answerable by the Human.'),
    context: D.string()
      .describe('Exactly what was found in the code that produced this question. Reference specific paths or logic so the Human understands why the question matters.'),
  })),
})
