import { type App, requestUrl } from 'obsidian'
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

    constructor(
        app: App,
        private readonly settings: PluginSettings
    ) {
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
        await materializeRemoteCover(book, tempDir)
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
        const prefix = path.join(os.tmpdir(), `book-exporter-${slug}-`)
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
            throw new Error(`Output folder must be an absolute path or start with "~". Got: ${raw}`)
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

/**
 * If the cover is an `http(s)` URL, downloads it into the temp dir and
 * rewrites `book.metadata.coverPath` in place to the local path so the
 * rest of the pipeline (pandoc, etc.) can treat covers uniformly. The
 * extension is taken from the URL path; falls back to `.img` so pandoc
 * can still load the bytes.
 */
async function materializeRemoteCover(book: ParsedBook, tempDir: string): Promise<void> {
    const cover = book.metadata.coverPath
    if (cover === undefined || !/^https?:\/\//i.test(cover)) return

    let extension = '.img'
    try {
        const urlPath = new URL(cover).pathname
        const ext = path.extname(urlPath)
        if (ext.length > 0 && ext.length <= 6) extension = ext
    } catch {
        // ignore — keep the .img fallback
    }

    const response = await requestUrl({ url: cover, method: 'GET', throw: false })
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to download cover from ${cover}: ${String(response.status)}`)
    }
    const buffer = new Uint8Array(response.arrayBuffer)
    const dest = path.join(tempDir, `cover${extension}`)
    await fs.writeFile(dest, buffer)
    book.metadata.coverPath = dest
}
