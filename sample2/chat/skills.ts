import Ductus from 'ductus'
import { ExploreInput, ExploreOutput } from './schemas.js'

export const ExploreSkill = Ductus.skill('ExploreSkill')
  .input(ExploreInput, '../prompts/explore.mx')
  .output(ExploreOutput)
