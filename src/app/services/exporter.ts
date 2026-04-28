import { TFile, type App } from 'obsidian'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { ExportFormat, ParsedBook } from '../domain/book-manifest.intf'
import type { ExportResult } from '../domain/export-options.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { ManuscriptCompiler, type CompiledManuscript } from './manuscript-compiler'
import { PandocRunner, buildOutputFilename } from './pandoc-runner'

/**
 * Orchestrates the full export pipeline: compile manuscript → run pandoc per
 * format → clean up the temp directory.
 */
export class BookExporter {
    private readonly compiler: ManuscriptCompiler
    private readonly pandoc: PandocRunner

    constructor(
        private readonly app: App,
        private readonly settings: PluginSettings,
        private readonly pluginConfigDir: string
    ) {
        this.compiler = new ManuscriptCompiler(app, settings)
        this.pandoc = new PandocRunner(settings)
    }

    /**
     * Compiles the manuscript only. The caller is responsible for cleaning up
     * the temp directory.
     */
    async compileOnly(book: ParsedBook): Promise<CompiledManuscript> {
        const tempDir = await this.makeTempDir(book)
        return this.compiler.compile(book, tempDir)
    }

    async export(book: ParsedBook, formats: ExportFormat[]): Promise<ExportResult[]> {
        if (formats.length === 0) return []

        const tempDir = await this.makeTempDir(book)
        const compiled = await this.compiler.compile(book, tempDir)
        const outputDir = await this.resolveOutputDir(book)
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
        const adapter = this.app.vault.adapter
        const getFullPath = (adapter as { getFullPath?: (p: string) => string }).getFullPath
        const base =
            typeof getFullPath === 'function'
                ? getFullPath.call(adapter, this.pluginConfigDir)
                : path.join(this.pluginConfigDir)
        const dir = path.join(base, '.tmp', slug)
        await fs.rm(dir, { recursive: true, force: true })
        await fs.mkdir(dir, { recursive: true })
        return dir
    }

    /**
     * Resolves the output directory. Per-book override beats settings default.
     * The directory is vault-relative and created if missing.
     */
    private async resolveOutputDir(book: ParsedBook): Promise<string> {
        const relative =
            book.overrides.outputDir !== undefined
                ? book.overrides.outputDir
                : this.settings.defaultOutputDir
        const adapter = this.app.vault.adapter
        const getFullPath = (adapter as { getFullPath?: (p: string) => string }).getFullPath
        const absolute =
            typeof getFullPath === 'function' ? getFullPath.call(adapter, relative) : relative
        await fs.mkdir(absolute, { recursive: true })

        // Ensure Obsidian sees the new folder.
        const folderInVault = this.app.vault.getAbstractFileByPath(relative)
        if (folderInVault === null) {
            try {
                await this.app.vault.createFolder(relative)
            } catch {
                // already exists or path outside the vault — both fine.
            }
        } else if (folderInVault instanceof TFile) {
            throw new Error(`Configured output dir is a file, not a folder: ${relative}`)
        }

        return absolute
    }
}
