import Ductus from 'ductus'
import TaskCompleteEvent from "../events/TaskCompleteEvent.mjs";
import TaskEvent from "../events/TaskEvent.mjs";

export default Ductus.reducer()
    .when(TaskCompleteEvent, (state, action) => {
        const nextTaskIndex = state.activeTaskIndex + 1
        const nextTask = state.tasks[nextTaskIndex]

        if (!nextTask) {
            return [state, []];
        }

        const newState = {
            ...state,
            activeTaskIndex: nextTaskIndex,
        }

        return [newState, [new TaskEvent(nextTask)]]
    })
