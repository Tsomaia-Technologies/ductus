import { PlannerHeadersSchema, Task, TaskListSchema, TaskSchemaJSON } from '../schema'
import { execa } from 'execa'
import { execSync } from 'child_process'
import { extractJsonArray } from '../utils'
import { loadPrompts } from '../load-prompts'

export async function convertPlanToTasks(plan: string): Promise<Task[]> {
  let success = false;
  let i = 0;

  const prompts = loadPrompts('planner', { plan, schema: TaskSchemaJSON });
  console.log(`Found ${prompts.length} planner prompts`)

  const maxTrials = Math.max(prompts.length, 5);

  while (!success && i < maxTrials) {
    try {
      const { data, content } = prompts[i]
      const { model } = PlannerHeadersSchema.parse(data)
      const command = `agent --mode plan --model ${model} --output-format=text --print "${content}"`

      console.log(`[convertPlanToTasks] trial #${i + 1}/${maxTrials}:`, command)
      const raw = execSync(command).toString();

      return TaskListSchema.parse(JSON.parse(extractJsonArray(raw)));
    } catch (e) {
      ++i
      console.log(`[convertPlanToTasks] iteration: ${i}, error:`, e?.toString())
    }
  }

  throw new Error('Unable to convert plans to tasks.');
}
