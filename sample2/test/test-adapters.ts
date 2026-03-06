import Ductus from 'ductus'
import path from 'path'
import { fileURLToPath } from 'url'
import { CliAdapterBuilder } from '../../src/interfaces/builders/cli-adapter-builder.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * TestCliAdapter that points to our emulator.ts
 */
export const TestCliAdapter = (Ductus.adapter('cli') as any as CliAdapterBuilder)
    .command('node')
    .args(path.join(__dirname, 'emulator.js'))
    .cwd(__dirname);
