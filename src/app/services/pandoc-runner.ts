import { spawn } from 'node:child_process'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { ExportFormat, ParsedBook, PdfEngine } from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { CompiledManuscript } from './manuscript-compiler'

export interface PandocResult {
    outputPath: string
    durationMs: number
    stderr: string
}

/**
 * Wraps `pandoc` as a child process. Resolves binaries via the plugin
 * settings (defaults to relying on `$PATH`).
 */
export class PandocRunner {
    constructor(private readonly settings: PluginSettings) {}

    async run(
        format: 'epub' | 'pdf',
        book: ParsedBook,
        compiled: CompiledManuscript,
        outputPath: string
    ): Promise<PandocResult> {
        await fs.mkdir(path.dirname(outputPath), { recursive: true })

        const args = this.buildArgs(format, book, compiled, outputPath)
        const started = Date.now()
        const stderr = await runProcess(this.settings.pandocPath, args, compiled.tempDir)
        return { outputPath, durationMs: Date.now() - started, stderr }
    }

    private buildArgs(
        format: 'epub' | 'pdf',
        book: ParsedBook,
        compiled: CompiledManuscript,
        outputPath: string
    ): string[] {
        const args: string[] = [
            compiled.manuscriptPath,
            '-o',
            outputPath,
            '--metadata-file',
            compiled.metadataPath,
            '--from=markdown+yaml_metadata_block+pipe_tables+task_lists+strikeout+fenced_divs',
            '--top-level-division=chapter',
            '--standalone',
            '--resource-path',
            compiled.tempDir
        ]

        const includeToc = book.overrides.includeToc ?? this.settings.includeTocByDefault
        if (includeToc) {
            args.push('--toc')
            const depth = book.overrides.tocDepth ?? this.settings.tocDepthDefault
            args.push(`--toc-depth=${String(depth)}`)
        }

        if (format === 'epub' && book.metadata.coverPath !== undefined) {
            args.push('--epub-cover-image', book.metadata.coverPath)
        }
        if (format === 'pdf') {
            const engine: PdfEngine = book.overrides.pdfEngine ?? this.settings.defaultPdfEngine
            args.push(`--pdf-engine=${engine}`)
        }

        if (book.overrides.pandocExtraArgs !== undefined) {
            args.push(...book.overrides.pandocExtraArgs)
        }

        return args
    }
}

/**
 * Builds the full output filename (slug + date + extension).
 */
export function buildOutputFilename(book: ParsedBook, format: ExportFormat): string {
    const slug = slugify(book.metadata.title)
    const date = new Date().toISOString().slice(0, 10)
    return `${slug}_${date}.${format}`
}

function slugify(value: string): string {
    return (
        value
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'book'
    )
}

export function runProcess(bin: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn(bin, args, { cwd })
        const stderrChunks: Uint8Array[] = []
        proc.stdout.on('data', () => {})
        proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(new Uint8Array(chunk)))
        proc.on('error', (err) => {
            reject(new Error(`Failed to start ${bin}: ${err.message}`))
        })
        proc.on('close', (code) => {
            const stderr = Buffer.concat(stderrChunks).toString('utf8')
            if (code === 0) {
                resolve(stderr)
                return
            }
            const tail = stderr.split('\n').slice(-20).join('\n')
            reject(new Error(`${bin} exited with code ${String(code)}\n${tail}`))
        })
    })
}
