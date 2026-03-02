import { Flow } from 'ductus'
import ApprovalSchema from "./schemas/ApprovalSchema.mjs";
import RejectionSchema from "./schemas/RejectionSchema.mjs";
import RequestChangesEvent from "./events/RequestChangesEvent.mjs";
import ReviewerAgent from "./agents/ReviewerAgent.mjs";
import ImplementationReport from "./events/ImplementationReportEvent.mjs";
import TaskEvent from "./events/TaskEvent.mjs";
import EngineerAgent from "./agents/EngineerAgent.mjs";
import ImplementationReportEvent from "./events/ImplementationReportEvent.mjs";

export default Flow
    .when(TaskEvent, Flow // or maybe Flow.atom() as a separate that defines its own "when()"-s and "then()"s in their separate files, then we simply bundle atoms in the central flow.mjs file
        .then(Flow.invoke(EngineerAgent.skills.implement))
        .then(Flow.emit(ImplementationReportEvent))
    )
    .when(ImplementationReport, Flow
        .then(Flow.invoke(ReviewerAgent.skills.review))
        .then(Flow.matchAndEmit() // or simply .match()?
            .case(ApprovalSchema, NextTaskEvent) // NextTaskEvent is some kind of system event that "ductus" understands? but sounds "specific". what is the better approach?
            .case(RejectionSchema, RequestChangesEvent)
        )
    )
    .when(RequestChangesEvent, Flow
        .then(Flow.invoke(EngineerAgent.skills.resolveComments))
        .then(Flow.emit(ImplementationReportEvent))
    )
