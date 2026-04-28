import { type App } from 'obsidian'
import * as path from 'node:path'
import * as os from 'node:os'
import { promises as fs } from 'node:fs'
import type { ExportFormat, ParsedBook } from '../domain/book-manifest.intf'
import type { ExportResult } from '../domain/export-options.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { ManuscriptCompiler, type CompiledManuscript } from './manuscript-compiler'
import { PandocRunner, buildOutputFilename } from './pandoc-runner'

/**
 * Orchestrates the full export pipeline: compile manuscript → run pandoc per
 * format → clean up the temp directory.
 *
 * Temp files live in the OS temp folder (`os.tmpdir()`), never inside the
 * vault. The output folder is configured by the user as an absolute
 * filesystem path (with optional `~` expansion); the plugin refuses to
 * export when it is not set.
 */
export class BookExporter {
    private readonly compiler: ManuscriptCompiler
    private readonly pandoc: PandocRunner

    constructor(app: App, private readonly settings: PluginSettings) {
        this.compiler = new ManuscriptCompiler(app, settings)
        this.pandoc = new PandocRunner(settings)
    }

    /**
     * Compiles the manuscript only. The caller is responsible for cleaning
     * up the temp directory.
     */
    async compileOnly(book: ParsedBook): Promise<CompiledManuscript> {
        const tempDir = await this.makeTempDir(book)
        return this.compiler.compile(book, tempDir)
    }

    async export(book: ParsedBook, formats: ExportFormat[]): Promise<ExportResult[]> {
        if (formats.length === 0) return []

        const outputDir = await this.resolveOutputDir(book)
        const tempDir = await this.makeTempDir(book)
        const compiled = await this.compiler.compile(book, tempDir)
        const results: ExportResult[] = []

        try {
            for (const format of formats) {
                const outputPath = path.join(outputDir, buildOutputFilename(book, format))
                const r = await this.pandoc.run(format, book, compiled, outputPath)
                results.push({ format, outputPath: r.outputPath, durationMs: r.durationMs })
            }
        } finally {
            if (!this.settings.keepTempFiles) {
                await fs.rm(tempDir, { recursive: true, force: true })
            }
        }

        return results
    }

    private async makeTempDir(book: ParsedBook): Promise<string> {
        const slug = path.basename(book.bookNotePath, '.md').replace(/[^A-Za-z0-9._-]/g, '_')
        const prefix = path.join(os.tmpdir(), `obsidian-book-exporter-${slug}-`)
        return fs.mkdtemp(prefix)
    }

    /**
     * Resolves the output directory. Per-book override beats settings default.
     * Both are absolute filesystem paths; `~`/`~user` is expanded.
     * Throws when neither is set so the user gets a clear, actionable error
     * instead of a Pandoc failure.
     */
    private async resolveOutputDir(book: ParsedBook): Promise<string> {
        const raw =
            book.overrides.outputDir !== undefined
                ? book.overrides.outputDir
                : this.settings.defaultOutputDir
        const trimmed = raw.trim()
        if (trimmed.length === 0) {
            throw new Error(
                'Output folder is not configured. Set "Default output folder" in Settings → Book Exporter (e.g. ~/Downloads).'
            )
        }
        const absolute = expandHome(trimmed)
        if (!path.isAbsolute(absolute)) {
            throw new Error(
                `Output folder must be an absolute path or start with "~". Got: ${raw}`
            )
        }
        await fs.mkdir(absolute, { recursive: true })
        return absolute
    }
}

export function expandHome(p: string): string {
    if (p === '~') return os.homedir()
    if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
    return p
}
