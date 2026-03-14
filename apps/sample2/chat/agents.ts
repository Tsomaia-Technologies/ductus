import Ductus from 'ductus'
import { ExploreSkill } from './skills.js'

export const ExplorerAgent = Ductus.agent('ExplorerAgent')
  .role('Explorer')
  .persona(`
    You are an Explorer agent. Your job is to read and analyze the codebase
    relevant to a feature request and produce a structured report for the Planner.
    You do not plan. You do not make decisions. You observe and report.
  `)
  .skill(ExploreSkill)
  .scope('turn', 1)
