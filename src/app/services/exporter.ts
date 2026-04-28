import { TFile, type App } from 'obsidian'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { ExportFormat, ParsedBook } from '../domain/book-manifest.intf'
import type { ExportResult } from '../domain/export-options.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { ManuscriptCompiler, type CompiledManuscript } from './manuscript-compiler'
import { CalibreRunner } from './calibre-runner'
import { PandocRunner, buildOutputFilename } from './pandoc-runner'

/**
 * Orchestrates the full export pipeline: compile manuscript → run pandoc per
 * format → run calibre when MOBI is requested → clean up the temp directory.
 */
export class BookExporter {
    private readonly compiler: ManuscriptCompiler
    private readonly pandoc: PandocRunner
    private readonly calibre: CalibreRunner

    constructor(
        private readonly app: App,
        private readonly settings: PluginSettings,
        private readonly pluginConfigDir: string
    ) {
        this.compiler = new ManuscriptCompiler(app, settings)
        this.pandoc = new PandocRunner(settings)
        this.calibre = new CalibreRunner(settings)
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
            const requested = new Set(formats)
            const needsEpubFirst = requested.has('mobi') && !requested.has('epub')
            const epubPath = path.join(outputDir, buildOutputFilename(book, 'epub'))

            if (requested.has('epub') || needsEpubFirst) {
                const r = await this.pandoc.run('epub', book, compiled, epubPath)
                if (requested.has('epub')) {
                    results.push({ format: 'epub', outputPath: r.outputPath, durationMs: r.durationMs })
                }
            }

            if (requested.has('pdf')) {
                const pdfPath = path.join(outputDir, buildOutputFilename(book, 'pdf'))
                const r = await this.pandoc.run('pdf', book, compiled, pdfPath)
                results.push({ format: 'pdf', outputPath: r.outputPath, durationMs: r.durationMs })
            }

            if (requested.has('mobi')) {
                const mobiPath = path.join(outputDir, buildOutputFilename(book, 'mobi'))
                const r = await this.calibre.epubToMobi(epubPath, mobiPath)
                results.push({ format: 'mobi', outputPath: r.outputPath, durationMs: r.durationMs })
                if (needsEpubFirst) {
                    await fs.rm(epubPath, { force: true })
                }
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
