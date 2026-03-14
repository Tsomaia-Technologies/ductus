import Ductus from 'ductus'

export default Ductus.processor(async function* (events) {
  for await (const event of events) {
    console.log('event', event)
    yield
  }
})
