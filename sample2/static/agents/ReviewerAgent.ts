import Ductus from '../core.js'
import ReviewSkill from '../skills/ReviewSkill.js'

export default Ductus.agent('reviewer')
  .role('Lead Architect')
  .persona('Hostile reviewer. Zero Trust. Zero Tolerance. Verify everything manually.')
  .skill(ReviewSkill)
