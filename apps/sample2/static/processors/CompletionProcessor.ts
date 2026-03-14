import Ductus from 'ductus'
import { ApprovalEvent, TaskCompleteEvent, TaskEvent } from '../events/index.js'

export default Ductus.processor(async function* (events) {
    let lastTask = null

    for await (const event of events) {
        if (TaskEvent.is(event)) {
            lastTask = event.payload
        }

        if (ApprovalEvent.is(event)) {
            if (lastTask) {
                yield TaskCompleteEvent(lastTask)
            }
        }
    }
})
