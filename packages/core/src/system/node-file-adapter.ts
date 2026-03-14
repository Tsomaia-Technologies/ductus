import { FileAdapter } from '../interfaces/file-adapter.js'
import * as fs from 'node:fs/promises'
import { Json } from '../interfaces/json.js'
import { createReadStream } from 'node:fs'
import * as readline from 'node:readline'
import { FileHandleAdapter } from '../interfaces/file-handle-adapter.js'
import { NodeFileHandleAdapter } from './node-file-handle-adapter.js'

export class NodeFileAdapter implements FileAdapter {
  async exists(absolutePath: string): Promise<boolean> {
    try {
      await fs.stat(absolutePath)
      return true
    } catch {
      return false
    }
  }

  async read(
    absolutePath: string,
  ): Promise<string | null>
  async read(
    absolutePath: string,
    fallback: string,
  ): Promise<string>
  async read(
    absolutePath: string,
    fallback: string | null = null,
  ): Promise<string | null> {
    try {
      return await fs.readFile(absolutePath, 'utf8')
    } catch (error: any) {
      if (error.code === 'ENOENT') return fallback
      throw error
    }
  }

  async readJson(
    absolutePath: string,
  ): Promise<Json | null>
  async readJson(
    absolutePath: string,
    fallback: Json,
  ): Promise<Json>
  async readJson(
    absolutePath: string,
    fallback: Json | null = null,
  ): Promise<Json | null> {
    const content = await this.read(absolutePath)

    if (content === null) {
      return fallback
    }

    try {
      return JSON.parse(content)
    } catch (error: any) {
      throw new Error(`Failed to parse ${absolutePath}: ${error?.message}`)
    }
  }


  async* readLines(absolutePath: string): AsyncIterable<string> {
    const fileStream = createReadStream(absolutePath, {
      encoding: 'utf8',
    })
    const lines = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    yield* lines
  }

  async* readLinesJsonl(absolutePath: string): AsyncIterable<Json> {
    const lines = this.readLines(absolutePath)
    let currentLine = 0

    for await (const line of lines) {
      ++currentLine
      if (!line.trim().length) continue

      try {
        yield JSON.parse(line)
      } catch (error: any) {
        throw new Error(`Corrupted JSON found in ${absolutePath} at line ${currentLine}: ${error?.message}`)
      }
    }
  }

  async readLastLineJsonl(absolutePath: string): Promise<Json | null> {
    let fileHandle: fs.FileHandle | null = null
    try {
      fileHandle = await fs.open(absolutePath, 'r')
      const stat = await fileHandle.stat()
      if (stat.size === 0) return null

      const chunkSize = 4096
      const buffer = Buffer.alloc(chunkSize)
      let position = stat.size
      let leftover = ''

      while (position > 0) {
        const readLength = Math.min(chunkSize, position)
        position -= readLength

        const { bytesRead } = await fileHandle.read(buffer, 0, readLength, position)
        const chunkStr = buffer.toString('utf8', 0, bytesRead)

        const combined = chunkStr + leftover
        const lines = combined.split('\n')

        leftover = lines[0]

        for (let i = lines.length - 1; i > 0; i--) {
          const line = lines[i].trim()
          if (line) {
            return JSON.parse(line)
          }
        }
      }

      if (leftover.trim()) {
        return JSON.parse(leftover.trim())
      }
      return null
    } catch (e: any) {
      if (e.code === 'ENOENT') return null
      throw e
    } finally {
      await fileHandle?.close()
    }
  }

  async write(absolutePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(absolutePath, content, { encoding: 'utf8' })
      return true
    } catch (error: any) {
      if (error.code === 'EBUSY') return false
      throw error
    }
  }

  async writeJson(absolutePath: string, content: Json): Promise<boolean> {
    const jsonString = JSON.stringify(content)

    return await this.write(absolutePath, jsonString)
  }

  async append(absolutePath: string, content: string): Promise<void> {
    await fs.appendFile(absolutePath, content, { encoding: 'utf8' })
  }

  async appendLine(absolutePath: string, content: string): Promise<void> {
    await fs.appendFile(absolutePath, content + '\n', { encoding: 'utf8' })
  }

  async appendLineJsonl(absolutePath: string, content: Json): Promise<void> {
    const jsonString = JSON.stringify(content)
    await this.appendLine(absolutePath, jsonString)
  }

  async createDirectory(absolutePath: string): Promise<boolean> {
    try {
      await fs.mkdir(absolutePath)
      return true
    } catch (error: any) {
      if (error.code === 'EEXIST') return false
      throw error
    }
  }

  async createDirectoryRecursive(absolutePath: string): Promise<void> {
    await fs.mkdir(absolutePath, { recursive: true })
  }

  async delete(absolutePath: string): Promise<boolean> {
    try {
      await fs.rm(absolutePath, { recursive: true })
      return true
    } catch (error: any) {
      if (error.code === 'ENOENT') return false
      throw error
    }
  }

  async open(absolutePath: string, mode: 'a' | 'w'): Promise<FileHandleAdapter> {
    const handle = new NodeFileHandleAdapter()
    await handle.open(absolutePath, mode)
    return handle
  }
}
