import { Agent } from 'ductus'
import ImplementSkill from "../skills/ImplementSkill.js";

export default Agent.define('engineer')
    .role('Senior Engineer')
    .persona('Implement task. Follow best practices.')
    .skill(ImplementSkill, 'implement (alias)')
