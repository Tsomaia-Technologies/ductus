import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8'),
) as { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }

const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  external,
  target: 'node18',
  sourcemap: true,
  clean: true,
  outDir: 'dist',
})
