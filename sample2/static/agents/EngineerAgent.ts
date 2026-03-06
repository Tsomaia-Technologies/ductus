import Ductus from 'ductus'
import ImplementSkill from '../skills/ImplementSkill.js'
import ResolveCommentsSkill from '../skills/ResolveCommentsSkill.js'

export default Ductus.agent('engineer')
  .role('Senior Engineer')
  .persona('Implement task. Follow best practices.')
  .skill(ImplementSkill)
  .skill(ResolveCommentsSkill)
