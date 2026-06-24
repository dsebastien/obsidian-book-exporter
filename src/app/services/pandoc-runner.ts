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
            // The Typst writer renders citations natively (`@key` /
            // `#cite()` + `#bibliography()`). Run our filter for *every* Typst
            // export — even with no bibliography — so a stray `@token` can't
            // become a native `#cite()` that aborts with "document does not
            // contain a bibliography", and so a CSL bibliography isn't fed to
            // Typst's native reader. Ordered after --citeproc when active. See
            // issue #2.
            if (engine === 'typst' && compiled.citationFilterPath !== undefined) {
                args.push(`--lua-filter=${compiled.citationFilterPath}`)
            }
            // Full-bleed cover page. The header file renders the cover before
            // Pandoc's generated title page (issue #29). EPUB has its own cover
            // via --epub-cover-image.
            if (engine === 'typst' && compiled.coverHeaderTypstPath !== undefined) {
                args.push(`--include-in-header=${compiled.coverHeaderTypstPath}`)
            } else if (
                (engine === 'xelatex' || engine === 'tectonic') &&
                compiled.coverHeaderLatexPath !== undefined
            ) {
                args.push(`--include-in-header=${compiled.coverHeaderLatexPath}`)
            }
            const extras = book.overrides.pandocExtraArgs ?? []
            if (this.settings.defaultMainFont.length > 0 && !definesVar(extras, 'mainfont')) {
                args.push('-V', `mainfont=${this.settings.defaultMainFont}`)
            }
            if (this.settings.defaultMonoFont.length > 0 && !definesVar(extras, 'monofont')) {
                args.push('-V', `monofont=${this.settings.defaultMonoFont}`)
            }
            pushPageSetupArgs(args, engine, book, this.settings)
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
    // `geometry` is pinned as `-V geometry:margin=...`, so a `name:` prefix
    // also counts as "the user already set this variable".
    const colon = `${name}:`
    const matchesValue = (v: string): boolean =>
        v === name || v.startsWith(equals) || v.startsWith(colon)
    for (let i = 0; i < extras.length; i++) {
        const arg = extras[i]!
        if (arg === '-V' || arg === '--variable') {
            const next = extras[i + 1]
            if (next !== undefined && matchesValue(next)) return true
        }
        if (arg.startsWith(`-V${name}=`) || arg.startsWith(`-V ${name}=`)) return true
        if (arg.startsWith(`-V${name}:`) || arg.startsWith(`-V ${name}:`)) return true
        if (arg.startsWith(`--variable=${name}=`) || arg.startsWith(`--variable ${name}=`))
            return true
    }
    return false
}

/**
 * Like {@link definesVar} but for pandoc metadata (`-M` / `--metadata`).
 * Typst margins are set as a `margin.x` / `margin.y` map via `-M`, so a user
 * who pinned `margin` (any of `margin`, `margin=`, `margin.`) in
 * `pandoc_extra_args` should suppress our defaults.
 */
function definesMetadata(extras: string[], name: string): boolean {
    const matches = (v: string): boolean =>
        v === name || v.startsWith(`${name}=`) || v.startsWith(`${name}.`)
    for (let i = 0; i < extras.length; i++) {
        const arg = extras[i]!
        if (arg === '-M' || arg === '--metadata') {
            const next = extras[i + 1]
            if (next !== undefined && matches(next)) return true
        }
        if (arg.startsWith(`-M${name}`) || arg.startsWith(`--metadata=${name}`)) return true
    }
    return false
}

/**
 * Resolves the page-setup values (per-book override → plugin setting) and
 * pushes the engine-appropriate pandoc arguments for PDF exports:
 *
 * - **Typst** — `-V papersize`, `-V fontsize`, and a `-M margin.x/.y` map
 *   (the Typst template's `margin` is a dictionary, so it can't be a plain
 *   `-V`). Line spacing has no Typst template variable and is applied in the
 *   Typst preamble (`#set par(leading: ...)`, see `buildTypstPreamble`).
 * - **LaTeX** (xelatex / tectonic) — `-V papersize`, `-V geometry:margin`
 *   (geometry package), `-V fontsize`, and `-V linestretch` (setspace).
 *
 * Explicit `pandoc_extra_args` always win: when the user already pinned the
 * relevant variable, nothing is emitted.
 */
export function pushPageSetupArgs(
    args: string[],
    engine: PdfEngine,
    book: ParsedBook,
    settings: PluginSettings
): void {
    const isLatex = engine === 'xelatex' || engine === 'tectonic'

    const extras = book.overrides.pandocExtraArgs ?? []
    const pageSize = (book.overrides.pageSize ?? settings.pageSize).trim()
    const margin = (book.overrides.pageMargin ?? settings.pageMargin).trim()
    const lineSpacing = (book.overrides.lineSpacing ?? settings.lineSpacing).trim()
    const fontSize = normaliseFontSize((book.overrides.baseFontSize ?? settings.baseFontSize).trim())

    if (pageSize.length > 0 && !definesVar(extras, 'papersize')) {
        args.push('-V', `papersize=${isLatex ? latexPaper(pageSize) : typstPaper(pageSize)}`)
    }
    if (fontSize.length > 0 && !definesVar(extras, 'fontsize')) {
        args.push('-V', `fontsize=${fontSize}`)
    }
    if (margin.length > 0) {
        if (isLatex) {
            if (!definesVar(extras, 'geometry')) args.push('-V', `geometry:margin=${margin}`)
        } else if (!definesMetadata(extras, 'margin')) {
            args.push('-M', `margin.x=${margin}`, '-M', `margin.y=${margin}`)
        }
    }
    // Typst line spacing is emitted by the compiler (preamble), not here.
    if (lineSpacing.length > 0 && isLatex && !definesVar(extras, 'linestretch')) {
        args.push('-V', `linestretch=${lineSpacing}`)
    }
}

/** Appends `pt` to a bare numeric font size; passes through values with a unit. */
export function normaliseFontSize(value: string): string {
    if (value.length === 0) return value
    return /^[0-9]+(\.[0-9]+)?$/.test(value) ? `${value}pt` : value
}

/**
 * Normalises a user-facing paper-size name to a Typst `paper` value. Typst
 * uses hyphenated US names (`us-letter`, `us-legal`); ISO sizes (`a4`, `a5`,
 * `b5`, ...) pass through. Unknown values pass through verbatim.
 */
export function typstPaper(size: string): string {
    const s = size.trim().toLowerCase()
    if (s === 'letter' || s === 'us-letter') return 'us-letter'
    if (s === 'legal' || s === 'us-legal') return 'us-legal'
    return s
}

/**
 * Normalises a user-facing paper-size name to a LaTeX `papersize` value
 * (`a4` → `a4paper`, etc. is handled by the template; we only map the US
 * names off Typst's hyphenated form). `us-letter` → `letter`, `us-legal` →
 * `legal`; everything else passes through.
 */
export function latexPaper(size: string): string {
    const s = size.trim().toLowerCase()
    if (s === 'us-letter' || s === 'letter') return 'letter'
    if (s === 'us-legal' || s === 'legal') return 'legal'
    return s
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

/**
 * Recognises common pandoc / Typst failure signatures in stderr and returns a
 * one-line, actionable hint. Pandoc collapses many distinct errors into a
 * single non-zero exit (Typst's generic "Error 43"), so the raw tail alone is
 * hard to act on for users and maintainers alike (see issues #2, #35).
 * Returns `null` when nothing matches, leaving the caller to show the raw
 * tail unchanged. Ordered most-specific first.
 */
export function classifyPandocError(stderr: string): string | null {
    const s = stderr.toLowerCase()

    // Citation: a `@key` was used but no bibliography is present. Typst hard-
    // errors here; our Lua filter normally prevents it (issue #2).
    if (s.includes('does not contain a bibliography')) {
        return 'A citation (`@key`) was used but no bibliography is set. Add a `bibliography:` field to the manifest frontmatter, or remove the stray `@token`.'
    }
    // Citation: the bibliography file format was not understood.
    if (s.includes('unknown bibliography format') || s.includes('error parsing bibliography')) {
        return "Bibliography format not recognised. Use a `.bib`, `.json`, or `.yaml` file for `bibliography:` — citeproc reads all three; Typst's native reader only takes `.bib`/`.yml`."
    }
    // Fonts: Typst needs a non-empty main font (Pandoc 3.6+).
    if (s.includes('font fallback list must not be empty')) {
        return 'No PDF main font is set. Set Settings → Book Exporter → PDF main font to a font installed on this machine (run `typst fonts` to list them).'
    }
    if (s.includes('unknown font family') || s.includes('unknown font')) {
        return 'A configured font is not installed on this machine. Pick one reported by `typst fonts` in Settings → Book Exporter → PDF main/mono font.'
    }
    // Missing PDF engine (pandoc: "… not found. Please select a different
    // --pdf-engine or install …").
    if (s.includes('please select a different') || s.includes('--pdf-engine')) {
        return 'The selected PDF engine could not be found. Install it, set Settings → Book Exporter → PDF engine path, or pick another engine.'
    }
    // Missing resource — usually an image.
    if (
        s.includes('file not found') ||
        s.includes('does not exist') ||
        s.includes('could not load') ||
        s.includes('could not fetch') ||
        s.includes('cannot find')
    ) {
        return 'A referenced file (often an image) could not be found. Check the path — remote `http(s)` images are not fetched for PDF, so embed a local copy instead.'
    }
    return null
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
            const lead = `${bin} exited with code ${String(code)}`
            const hint = classifyPandocError(stderr)
            reject(new Error(hint !== null ? `${lead}\nHint: ${hint}\n\n${tail}` : `${lead}\n${tail}`))
        })
    })
}
