#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { TaskSchemaJSON, TaskListSchema, TaskListSchemaJSON } from '../schema'
import { extractJsonArray } from '../utils'
import { convertPlanToTasks } from '../lambdas/convertPlanToTasks'

const program = new Command();

program
  .name('ductus')
  .description('Agent-to-agent coordination orchestrator for autonomous task execution')
  .argument('<feature>', 'feature name')
  .requiredOption('-p, --plan <path>', 'path to the plan file')
  .action(async (feature: string, options: { plan: string }) => {
    const planPath = options.plan;
    const cwd = process.cwd();
    const featureDir = path.join(cwd, '.ductus', feature);

    fs.mkdirSync(featureDir, { recursive: true });

    // 1. Read the master plan
    const planContent = fs.readFileSync(planPath, 'utf-8');

    console.log('🤖 Spawning Architect Agent to break down the plan...');

    // 2. The Architect Phase: Force JSON output for the orchestrator to parse
//     const architectPrompt = `
// You are the Lead Architect. Break the provided plan down into actionable engineering tasks.
//
// CRITICAL INSTRUCTION: Your exact output will be strictly parsed and validated against the following JSON schema by an automated script. Any deviation, extra conversational text, markdown formatting, or missing fields will cause a fatal pipeline failure. You must comply perfectly.
// ${TaskListSchemaJSON}
//
// Here is the master plan to process:
// ${planContent}
// `;
//
//     const raw = execSync(`agent --mode plan --model auto --output-format=text --print "${architectPrompt}"`).toString();
//     const parseResult = TaskListSchema.safeParse(JSON.parse(extractJsonArray(raw)));
//
//     console.log(parseResult.data);

      const tasks = await convertPlanToTasks(planContent);

      fs.writeFileSync(
        path.join(featureDir, 'tasks.json'),
        JSON.stringify(tasks, null, 2),
        'utf-8',
      );

    // const tasks = JSON.parse(rawJson);
    // console.log(`✅ Architect identified ${tasks.length} tasks. Spawning Engineers...`);
    //
    // // 3. The Engineer Phase: Loop through and execute locally
    // for (const [index, task] of tasks.entries()) {
    //   console.log(`\n👷 Engineer starting Task ${index + 1}/${tasks.length}: ${task.id} - ${task.summary}`);
    //
    //   const engineerPrompt = `
    // You are the Engineer. Implement the following task exactly as described.
    // Make the necessary file changes locally.
    // Task: ${task.id} - ${task.summary}
    // Details: ${task.description}
    // `;
    //
    //   try {
    //     // The --force flag lets the agent edit your local files without pausing for interactive confirmation
    //     execSync(`cursor-agent --model auto --force "${engineerPrompt}"`, { stdio: 'inherit' });
    //     console.log(`✅ Task ${index + 1} completed successfully.`);
    //   } catch (error) {
    //     // Here is where you could grab stderr and feed it back to a debugging agent
    //     console.error(`❌ Engineer failed on Task ${index + 1} (${task.id}). Handling error...`);
    //   }
    // }
    //
    // console.log('\n🎉 Orchestration complete. All tasks executed.');
  });

program.parse();
