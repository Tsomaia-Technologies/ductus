import Ductus from 'ductus'

export const CursorCliAdapter = Ductus.adapter('cli')
  .command(model => `agent -p --output-format text --stream-partial-output --model ${model}`)
