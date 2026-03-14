import kernel from './kernel.js'

async function main() {
  await kernel.boot()
  await kernel.monitor()
}

main().catch(console.error)
