import { Event } from 'ductus'
import ImplementationReport from "../schemas/implementation-report.mjs";

export default Event.define('ImplementationReport')
    .payload(ImplementationReport)
