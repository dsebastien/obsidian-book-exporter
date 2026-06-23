import { Notice, TFile, type App } from 'obsidian'
import type BookExporterPlugin from '../../main'
import type { ExportFormat, ParsedBook } from '../domain/book-manifest.intf'
import type { ExportOutcome } from '../domain/export-options.intf'
import { BookParser } from '../services/book-parser'
import { BookExporter, expandHome } from '../services/exporter'
import { BookValidator, formatReport } from '../services/validator'
import { log } from '../../utils/log'
import { openExternal } from '../../utils/open-path'

interface CommandContext {
    app: App
    plugin: BookExporterPlugin
}

export function registerCommands(plugin: BookExporterPlugin): void {
    const ctx: CommandContext = { app: plugin.app, plugin }

    plugin.addCommand({
        id: 'export-epub',
        name: 'Export current book to EPUB',
        callback: () => void runExport(ctx, ['epub'])
    })
    plugin.addCommand({
        id: 'export-pdf',
        name: 'Export current book to PDF',
        callback: () => void runExport(ctx, ['pdf'])
    })
    plugin.addCommand({
        id: 'export-all',
        name: 'Export current book to all formats',
        callback: () => void runExport(ctx, null)
    })
    plugin.addCommand({
        id: 'preview-manuscript',
        name: 'Preview compiled manuscript (.md)',
        callback: () => void runPreview(ctx)
    })
    plugin.addCommand({
        id: 'validate-book',
        name: 'Validate current book',
        callback: () => void runValidate(ctx)
    })
    plugin.addCommand({
        id: 'open-output-folder',
        name: 'Open exports folder',
        callback: () => void openOutputFolder(ctx)
    })
}

/* ------------------------------------------------------------------ */
/* command bodies                                                      */
/* ------------------------------------------------------------------ */

async function runExport(ctx: CommandContext, requested: ExportFormat[] | null): Promise<void> {
    if (ctx.plugin.settings.defaultOutputDir.trim().length === 0) {
        new Notice(
            'Output folder is not configured. Set "Default output folder" in Settings → Book Exporter (e.g. ~/Downloads).',
            10000
        )
        return
    }
    const setup = await prepareBook(ctx)
    if (setup === null) return
    const { book, exporter } = setup

    const formats = requested ?? book.overrides.formats ?? ctx.plugin.settings.defaultFormats
    if (formats.length === 0) {
        new Notice('No export formats selected.')
        return
    }

    new Notice(`Exporting "${book.metadata.title}" → ${formats.join(', ')}…`)
    try {
        const outcomes = await exporter.export(book, formats)
        const summary = summarizeOutcomes(outcomes)
        new Notice(summary.message, summary.hadFailure ? 12000 : undefined)
        log(
            `Export ${summary.hadFailure ? 'finished with failures' : 'complete'} for ${book.bookNotePath}`,
            summary.hadFailure ? 'warn' : 'info',
            outcomes
        )
    } catch (err) {
        // Reaches here only for failures that prevent any export at all
        // (e.g. manuscript compilation) — per-format failures are reported
        // by summarizeOutcomes instead.
        const msg = err instanceof Error ? err.message : String(err)
        log(`Export failed for ${book.bookNotePath}: ${msg}`, 'error', err)
        new Notice(`Export failed: ${truncate(msg, 200)}`)
    }
}

/**
 * Builds the user-facing Notice for a completed export run. Reports each
 * successful format with its duration and each failed format with its error,
 * so a partial success (e.g. EPUB ok, PDF failed) is never hidden behind a
 * single "Export failed". See issue #7.
 */
export function summarizeOutcomes(outcomes: ExportOutcome[]): {
    message: string
    hadFailure: boolean
} {
    const succeeded = outcomes.filter((o): o is Extract<ExportOutcome, { ok: true }> => o.ok)
    const failed = outcomes.filter((o): o is Extract<ExportOutcome, { ok: false }> => !o.ok)
    const hadFailure = failed.length > 0

    if (!hadFailure) {
        const list = succeeded
            .map((o) => `${o.format.toUpperCase()} (${(o.durationMs / 1000).toFixed(1)}s)`)
            .join(', ')
        return { message: `Book exported: ${list}`, hadFailure: false }
    }

    const parts: string[] = []
    if (succeeded.length > 0) {
        const list = succeeded
            .map((o) => `${o.format.toUpperCase()} (${(o.durationMs / 1000).toFixed(1)}s)`)
            .join(', ')
        parts.push(`Exported: ${list}.`)
    }
    const failList = failed
        .map((o) => `${o.format.toUpperCase()} — ${truncate(o.error, 160)}`)
        .join('; ')
    parts.push(`Failed: ${failList}`)
    return { message: parts.join(' '), hadFailure: true }
}

async function runPreview(ctx: CommandContext): Promise<void> {
    const setup = await prepareBook(ctx)
    if (setup === null) return
    const { book, exporter } = setup
    try {
        // Discard the previous preview's temp dir before creating a new one so
        // they don't pile up for the session (issue #6). Skipped when the user
        // has opted to keep temp files for inspection.
        if (!ctx.plugin.settings.keepTempFiles) {
            await ctx.plugin.previewTempDirs.cleanupAll()
        }
        const compiled = await exporter.compileOnly(book)
        if (!ctx.plugin.settings.keepTempFiles) {
            ctx.plugin.previewTempDirs.register(compiled.tempDir)
        }
        new Notice(`Manuscript compiled: ${compiled.manuscriptPath}`)
        await openExternal(compiled.manuscriptPath)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        new Notice(`Preview failed: ${truncate(msg, 200)}`)
    }
}

async function runValidate(ctx: CommandContext): Promise<void> {
    const file = activeBookFile(ctx)
    if (file === null) return
    const parser = new BookParser(ctx.app, ctx.plugin.settings)
    const validator = new BookValidator(ctx.app)
    try {
        const book = await parser.parse(file)
        const report = validator.validate(book)
        new Notice(formatReport(report), 8000)
        log(formatReport(report), report.hasErrors ? 'warn' : 'info')
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        new Notice(`Validation failed: ${truncate(msg, 200)}`)
    }
}

async function openOutputFolder(ctx: CommandContext): Promise<void> {
    const raw = ctx.plugin.settings.defaultOutputDir.trim()
    if (raw.length === 0) {
        new Notice('Output folder is not configured. Set it in Settings → Book Exporter.')
        return
    }
    try {
        await openExternal(expandHome(raw))
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        new Notice(`Could not open folder: ${truncate(msg, 200)}`)
    }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

async function prepareBook(
    ctx: CommandContext
): Promise<{ book: ParsedBook; exporter: BookExporter } | null> {
    const file = activeBookFile(ctx)
    if (file === null) return null

    const parser = new BookParser(ctx.app, ctx.plugin.settings)
    const validator = new BookValidator(ctx.app)
    try {
        const book = await parser.parse(file)
        const report = validator.validate(book)
        if (report.hasErrors) {
            new Notice(`Cannot export — ${formatReport(report)}`, 8000)
            return null
        }
        const exporter = new BookExporter(ctx.app, ctx.plugin.settings)
        return { book, exporter }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        new Notice(`Could not parse book: ${truncate(msg, 200)}`)
        return null
    }
}

function activeBookFile(ctx: CommandContext): TFile | null {
    const active = ctx.app.workspace.getActiveFile()
    if (!(active instanceof TFile) || active.extension !== 'md') {
        new Notice('Open the book manifest note before running this command.')
        return null
    }
    return active
}

function truncate(value: string, max: number): string {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}
