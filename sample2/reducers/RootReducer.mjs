import Ductus from 'ductus'
import TaskReducer from './TaskReducer.mjs';
import SomeOtherReducer from './SomeOtherReducer.mjs';

export default Ductus.reducer()
    .combine(TaskReducer)
    .combine(SomeOtherReducer)
