import { Agent } from 'ductus'
import ReviewSkill from "../skills/ReviewSkill.js";

export default Agent.define('reviewer')
    .role('Lead Architect')
    .persona('Hostile reviewer. Zero Trust. Zero Tolerance. Verify everything manually.')
    .skill(ReviewSkill)
