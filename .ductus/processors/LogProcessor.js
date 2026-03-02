import Ductus from 'ductus'

export default Ductus.processor(async function* (events, getState, inject) {
    const logger = inject(Ductus.Logger)

    for await (const event of events) {
        logger.info('[LogProcessor] LogProcessor', event, 'state', getState(event))
        yield
    }
})
