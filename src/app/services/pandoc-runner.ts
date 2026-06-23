import { spawn } from 'node:child_process'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { ExportFormat, ParsedBook, PdfEngine } from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { CompiledManuscript } from './manuscript-compiler'
import { buildSpawnEnv, type SpawnEnv } from '../../utils/spawn-env'

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
        format: ExportFormat,
        book: ParsedBook,
        compiled: CompiledManuscript,
        outputPath: string
    ): Promise<PandocResult> {
        await fs.mkdir(path.dirname(outputPath), { recursive: true })

        const args = this.buildArgs(format, book, compiled, outputPath)
        const started = Date.now()
        const stderr = await runProcess(this.settings.pandocPath, args, compiled.tempDir, {
            env: buildSpawnEnv(this.settings.extraPath)
        })
        return { outputPath, durationMs: Date.now() - started, stderr }
    }

    private buildArgs(
        format: ExportFormat,
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
            '--from=markdown+yaml_metadata_block+pipe_tables+task_lists+strikeout+fenced_divs+smart',
            '--top-level-division=chapter',
            '--standalone',
            '--resource-path',
            compiled.tempDir
        ]

        const includeToc = book.overrides.includeToc ?? this.settings.includeTocByDefault
        if (includeToc) {
            args.push('--toc')
            args.push(`--toc-depth=${String(pickTocDepth(book, this.settings))}`)
        }

        const numberSections = book.overrides.numberSections ?? this.settings.numberSections
        if (numberSections) args.push('--number-sections')

        // Citations are enabled implicitly by the manifest providing a
        // `bibliography:` (or `csl:`) frontmatter field. The compiler wrote
        // the bibliography path into the metadata YAML; here we just flip the
        // flag so citeproc renders the citations and reference list.
        const hasCitations = book.metadata.bibliographyPath !== undefined
        if (hasCitations) args.push('--citeproc')

        if (format === 'epub' && book.metadata.coverPath !== undefined) {
            args.push('--epub-cover-image', book.metadata.coverPath)
        }
        if (format === 'pdf') {
            const engine: PdfEngine = book.overrides.pdfEngine ?? this.settings.defaultPdfEngine
            const engineArg = pickPdfEngineArg(engine, book, this.settings)
            args.push(`--pdf-engine=${engineArg}`)
            // The Typst writer renders citations natively (`@key` +
            // `#bibliography()`), which only reads .bib/.yml and breaks on
            // CSL-JSON/YAML bibliographies — the real cause of issue #2. This
            // filter (ordered *after* --citeproc) makes citeproc the sole
            // citation renderer, so Typst never touches the bibliography file.
            if (engine === 'typst' && hasCitations && compiled.citationFilterPath !== undefined) {
                args.push(`--lua-filter=${compiled.citationFilterPath}`)
            }
            // Full-bleed cover page for Typst PDFs. The header file renders the
            // cover before Pandoc's generated title page (issue #29). EPUB has
            // its own cover via --epub-cover-image; LaTeX engines are not yet
            // covered.
            if (engine === 'typst' && compiled.coverHeaderPath !== undefined) {
                args.push(`--include-in-header=${compiled.coverHeaderPath}`)
            }
            const extras = book.overrides.pandocExtraArgs ?? []
            if (this.settings.defaultMainFont.length > 0 && !definesVar(extras, 'mainfont')) {
                args.push('-V', `mainfont=${this.settings.defaultMainFont}`)
            }
            if (this.settings.defaultMonoFont.length > 0 && !definesVar(extras, 'monofont')) {
                args.push('-V', `monofont=${this.settings.defaultMonoFont}`)
            }
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

/**
 * Picks the `--toc-depth` value passed to pandoc. Resolution order:
 * 1. Per-book `book_export.toc_depth` override — author intent wins.
 * 2. Plugin setting `tocDepthAuto` enabled → derive from the manifest's
 *    deepest heading level (so a parts+chapters manifest gets depth 3
 *    automatically). Falls back to `tocDepthDefault` when the manifest
 *    has no parseable heading (validator already flags that case).
 * 3. Otherwise, the plugin's static `tocDepthDefault`.
 *
 * Result is clamped to [1, 6] — pandoc accepts higher values but they
 * have no effect; clamping keeps the CLI argument tidy.
 */
function pickTocDepth(book: ParsedBook, settings: PluginSettings): number {
    if (book.overrides.tocDepth !== undefined) {
        return clampDepth(book.overrides.tocDepth)
    }
    if (settings.tocDepthAuto) {
        if (book.maxHeadingLevel > 0) return clampDepth(book.maxHeadingLevel)
    }
    return clampDepth(settings.tocDepthDefault)
}

function clampDepth(value: number): number {
    if (!Number.isFinite(value)) return 1
    return Math.min(6, Math.max(1, Math.floor(value)))
}

/**
 * Returns true when the user has already pinned the given pandoc variable
 * (e.g. `mainfont`) via `book_export.pandoc_extra_args`. Avoids us
 * overriding their explicit choice with the plugin default.
 */
function definesVar(extras: string[], name: string): boolean {
    const equals = `${name}=`
    for (let i = 0; i < extras.length; i++) {
        const arg = extras[i]!
        if (arg === '-V' || arg === '--variable') {
            const next = extras[i + 1]
            if (next !== undefined && (next === name || next.startsWith(equals))) return true
        }
        if (arg.startsWith(`-V${name}=`) || arg.startsWith(`-V ${name}=`)) return true
        if (arg.startsWith(`--variable=${name}=`) || arg.startsWith(`--variable ${name}=`))
            return true
    }
    return false
}

/**
 * Resolves what to pass to `--pdf-engine=`. Per-book `pandoc_extra_args`
 * is the user's last-mile escape hatch — when they pinned an engine path
 * there, we trust it and do nothing (avoid emitting two `--pdf-engine`
 * flags). Otherwise, when the user configured a `pdfEnginePath` and the
 * selected engine matches the basename of that path (so a user with both
 * typst and xelatex won't have the typst path silently forwarded to a
 * xelatex export), we forward the full path. As a last resort we pass the
 * engine name and let pandoc resolve it via `PATH`.
 */
export function pickPdfEngineArg(
    engine: PdfEngine,
    book: ParsedBook,
    settings: PluginSettings
): string {
    if (definesArg(book.overrides.pandocExtraArgs ?? [], 'pdf-engine')) return engine
    const configured = settings.pdfEnginePath.trim()
    if (configured.length === 0) return engine
    const base = path.basename(configured).toLowerCase()
    const engineLower = engine.toLowerCase()
    if (base === engineLower || base.startsWith(`${engineLower}.`)) return configured
    return engine
}

/**
 * Mirrors `definesVar` but for top-level pandoc flags (e.g. `--pdf-engine`).
 * Matches both `--flag value` and `--flag=value` forms.
 */
function definesArg(extras: string[], flag: string): boolean {
    const long = `--${flag}`
    const equals = `${long}=`
    for (const arg of extras) {
        if (arg === long || arg.startsWith(equals)) return true
    }
    return false
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

export interface RunProcessOptions {
    /** Environment forwarded to the child process. Defaults to the parent's env. */
    env?: SpawnEnv
}

export function runProcess(
    bin: string,
    args: string[],
    cwd: string,
    options: RunProcessOptions = {}
): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn(bin, args, { cwd, env: options.env })
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
