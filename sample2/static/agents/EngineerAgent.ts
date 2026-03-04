import Ductus from '../core.js'
import ImplementSkill from '../skills/ImplementSkill.js';

export default Ductus.agent('engineer')
    .role('Senior Engineer')
    .persona('Implement task. Follow best practices.')
    .skill(ImplementSkill, 'implement (alias)')
