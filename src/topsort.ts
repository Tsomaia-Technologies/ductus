import type { Task } from './schema.js'

/**
 * Topological sort of tasks by dependsOn. Returns task ids in execution order.
 * Throws if circular dependency or invalid dependsOn reference.
 */
export function topSortTasks(tasks: Task[]): string[] {
  const idToTask = new Map(tasks.map((t) => [t.id, t]))
  const ids = tasks.map((t) => t.id)

  for (const task of tasks) {
    for (const dep of task.dependsOn ?? []) {
      if (!idToTask.has(dep)) {
        throw new Error(
          `Invalid dependsOn: task "${task.id}" references unknown task "${dep}". ` +
            `Valid ids: ${ids.join(', ')}`,
        )
      }
    }
  }

  const order: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const path: string[] = []

  function visit(id: string): void {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id)
      const cycle = path.slice(cycleStart).concat(id)
      throw new Error(
        `Circular dependency in tasks: ${cycle.join(' -> ')}. ` +
          `Edit .ductus/<feature>/tasks.json to fix or run refinement.`,
      )
    }
    visiting.add(id)
    path.push(id)

    const task = idToTask.get(id)
    for (const dep of task?.dependsOn ?? []) {
      visit(dep)
    }

    path.pop()
    visiting.delete(id)
    visited.add(id)
    order.push(id)
  }

  for (const id of ids) {
    visit(id)
  }

  return order
}
