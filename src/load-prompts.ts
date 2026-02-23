import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { render, type FileResolver } from '@tsomaiatech/moxite'

type GrayMatterFile = ReturnType<typeof matter>

function findMxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findMxFiles(full))
    } else if (entry.name.endsWith('.mx')) {
      files.push(full)
    }
  }
  return files
}

function getPackagePromptsRoot(): string {
  return path.join(__dirname, '..', 'src', 'prompts')
}

function getPackageConfigPath(): string {
  return path.join(__dirname, '..', 'src', 'config', 'config.json')
}

/**
 * Ejects prompts from the package into .ductus/prompts.
 * Scans package prompts root for subdirs with .mx files.
 * Without overwrite: copies only if target does not exist or has no .mx files.
 * With overwrite: always copies, overwriting existing.
 */
export function ejectPrompts(
  cwd = process.cwd(),
  options?: { overwrite?: boolean },
): void {
  const overwrite = options?.overwrite ?? false
  const sourceRoot = getPackagePromptsRoot()
  const targetRoot = path.join(cwd, '.ductus', 'prompts')

  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`No prompts source found at ${sourceRoot}`)
  }

  const hasPrompts = (dir: string) => findMxFiles(dir).length > 0
  const entries = fs.readdirSync(sourceRoot, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const folderName = entry.name
    const sourceDir = path.join(sourceRoot, folderName)
    const targetDir = path.join(targetRoot, folderName)

    if (!hasPrompts(sourceDir)) continue

    const targetHasPrompts = fs.existsSync(targetDir) && hasPrompts(targetDir)
    if (targetHasPrompts && !overwrite) continue

    fs.mkdirSync(path.dirname(targetDir), { recursive: true })
    if (overwrite && fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true })
    }
    fs.cpSync(sourceDir, targetDir, { recursive: true })
  }

  const configSource = getPackageConfigPath()
  const relayDir = path.join(cwd, '.relay')
  const configTarget = path.join(relayDir, 'config.json')
  if (fs.existsSync(configSource)) {
    const targetExists = fs.existsSync(configTarget)
    if (!targetExists || overwrite) {
      fs.mkdirSync(relayDir, { recursive: true })
      fs.cpSync(configSource, configTarget)
    }
  }
}

/**
 * Loads .mx prompt files from .ductus/prompts/<folderName>/,
 * renders each with Moxite using the provided context, parses frontmatter with gray-matter,
 * and returns the list of gray-matter objects.
 * Throws if prompts are missing; run "ductus eject" first.
 */
export function loadPrompts<T extends Record<string, unknown>>(
  folderName: string,
  context: T,
  cwd = process.cwd(),
): GrayMatterFile[] {
  const basePath = path.join(cwd, '.ductus', 'prompts', folderName)
  const sourceDir = path.join(getPackagePromptsRoot(), folderName)
  const mxFiles = findMxFiles(basePath)

  if (mxFiles.length === 0) {
    throw new Error(
      `No prompts found for "${folderName}". Run "ductus eject" first. Expected prompts at ${basePath} or ${sourceDir}`,
    )
  }

  const resolver: FileResolver = (requestPath: string, fromPath?: string) => {
    const dir = fromPath ? path.dirname(fromPath) : basePath
    const fullPath = path.resolve(dir, requestPath)
    if (!fullPath.startsWith(basePath)) {
      throw new Error(`@use path escapes prompts folder: ${requestPath}`)
    }
    return fs.readFileSync(fullPath, 'utf-8')
  }

  return mxFiles.map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const rendered = render(raw, context, { resolver })
    return matter(rendered)
  })
}
