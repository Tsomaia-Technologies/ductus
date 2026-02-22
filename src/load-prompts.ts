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
  return path.join(__dirname, '..', 'prompts')
}

/**
 * Ejects prompts from the package into .ductus/prompts if the target is empty or missing.
 */
function ejectPromptsIfNeeded(folderName: string, cwd: string): void {
  const targetDir = path.join(cwd, '.ductus', 'prompts', folderName)
  const sourceDir = path.join(getPackagePromptsRoot(), folderName)

  const hasPrompts = (dir: string) => findMxFiles(dir).length > 0
  const targetHasPrompts = fs.existsSync(targetDir) && hasPrompts(targetDir)

  if (targetHasPrompts) return

  if (!fs.existsSync(sourceDir) || !hasPrompts(sourceDir)) {
    throw new Error(
      `No prompts found. Expected prompts at ${sourceDir} or ${targetDir}`,
    )
  }

  fs.mkdirSync(path.dirname(targetDir), { recursive: true })
  fs.cpSync(sourceDir, targetDir, { recursive: true })
}

/**
 * Loads .mx prompt files from .ductus/prompts/<folderName>/ (or ejects from package if needed),
 * renders each with Moxite using the provided context, parses frontmatter with gray-matter,
 * and returns the list of gray-matter objects.
 */
export function loadPrompts<T extends Record<string, unknown>>(
  folderName: string,
  context: T,
  cwd = process.cwd(),
): GrayMatterFile[] {
  ejectPromptsIfNeeded(folderName, cwd)

  const basePath = path.join(cwd, '.ductus', 'prompts', folderName)
  const mxFiles = findMxFiles(basePath)

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
