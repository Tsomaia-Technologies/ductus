import { Skill } from 'ductus'
import ImplementationReportSchema from './ImplementSkill.js';
import ReviewSchema from '../schemas/ReviewResultSchema.mjs';

export default Skill.define('review')
    .input(ImplementationReportSchema, '../templates/implementation-report.mx')
    .output(ReviewSchema)
