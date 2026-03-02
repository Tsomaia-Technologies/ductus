import { Skill } from 'ductus'
import TaskSchema from "../events/TaskEvent.mjs";
import ImplementationReportSchema from "../schemas/ImplementationReportSchema.mjs";

export default Skill.define('implement')
    .input(TaskSchema, '../templates/task.mx')
    .output(ImplementationReportSchema)
