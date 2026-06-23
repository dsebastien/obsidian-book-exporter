import { TFile, type App } from 'obsidian'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type {
    BookSection,
    InlinedNoteSeparator,
    NoteReference,
    ParsedBook
} from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import {
    convertThematicBreaksToPageBreaks,
    stripFrontmatter,
    stripSkippedSections
} from '../../utils/markdown'

export interface CompiledManuscript {
    /** Absolute path of the combined `.md` file. */
    manuscriptPath: string
    /** Absolute path of the image-resources folder. */
    resourcesDir: string
    /** Absolute path of the temp dir holding both. Caller can delete after use. */
    tempDir: string
    /** Pandoc YAML metadata file (absolute path). */
    metadataPath: string
    /**
     * Absolute path of the Lua filter that converts citeproc-rendered
     * citations to plain text for the Typst writer, or `undefined` when the
     * manifest declares no bibliography. See {@link CITEPROC_TYPST_FILTER}.
     */
    citationFilterPath?: string
}

/**
 * Walks a {@link ParsedBook}'s heading tree and produces a single Markdown
 * file for Pandoc. Each section's heading is emitted at its original level,
 * its referenced notes are inlined under it (frontmatter stripped, configured
 * sections skipped, headings demoted to fit), and child sections are rendered
 * recursively.
 */
export class ManuscriptCompiler {
    constructor(
        private readonly app: App,
        private readonly settings: PluginSettings
    ) {}

    async compile(book: ParsedBook, tempDir: string): Promise<CompiledManuscript> {
        const resourcesDir = path.join(tempDir, '_resources')
        await fs.mkdir(resourcesDir, { recursive: true })

        const sectionsToSkip = book.overrides.sectionsToSkip ?? this.settings.sectionsToSkip
        const transformer = new BodyTransformer(this.app, resourcesDir, {
            expandNoteEmbeds: this.settings.inlineNoteEmbeds,
            noteEmbedMaxDepth: Math.max(1, Math.floor(this.settings.noteEmbedMaxDepth)),
            sectionsToSkip
        })
        const pageBreakEnabled =
            book.overrides.pageBreakPerChapter ?? this.settings.pageBreakPerChapterDefault
        const noteSeparator =
            book.overrides.inlinedNoteSeparator ?? this.settings.inlinedNoteSeparator
        const levels = collectLevels(book.sections)
        const partLevel = levels.length > 0 ? Math.min(...levels) : Number.MAX_SAFE_INTEGER
        const chapterLevel = pickChapterLevel(levels, partLevel)

        const frontMatterTitles = normaliseTitles(book.overrides.frontMatterSections ?? [])
        const hasFrontMatter = frontMatterTitles.size > 0

        const parts: string[] = []
        parts.push(buildTypstPreamble(this.settings))
        parts.push('')
        if (hasFrontMatter) parts.push(FRONT_MATTER_OPEN)
        parts.push(`# ${book.metadata.title}`)
        parts.push('')

        let isFirstAtPartLevel = true
        let bodyMatterStarted = !hasFrontMatter
        for (const section of book.sections) {
            const isFront =
                hasFrontMatter && frontMatterTitles.has(section.title.trim().toLowerCase())
            let breakKind: PageBreak = 'none'
            if (pageBreakEnabled && !isFirstAtPartLevel) {
                breakKind = partLevel === chapterLevel ? 'chapter' : 'part'
            }
            isFirstAtPartLevel = false

            // Insert the body-matter transition right before the first
            // non-front-matter section. The transition includes its own
            // page break, so we suppress the chapter/part break that
            // would otherwise duplicate it.
            if (!isFront && !bodyMatterStarted) {
                parts.push(BODY_MATTER_OPEN)
                bodyMatterStarted = true
                breakKind = 'none'
            }

            const rendered = await this.renderSection(
                section,
                transformer,
                sectionsToSkip,
                breakKind,
                pageBreakEnabled,
                partLevel,
                chapterLevel,
                noteSeparator
            )
            parts.push(rendered)
        }

        const manuscriptPath = path.join(tempDir, 'manuscript.md')
        await fs.writeFile(manuscriptPath, parts.join('\n').trim() + '\n', 'utf8')

        const citationPaths = await copyCitationAssets(book, tempDir)
        const metadataPath = path.join(tempDir, 'metadata.yaml')
        await fs.writeFile(metadataPath, buildMetadataYaml(book, citationPaths), 'utf8')

        let citationFilterPath: string | undefined
        if (book.metadata.bibliographyPath !== undefined) {
            citationFilterPath = path.join(tempDir, 'citeproc-typst.lua')
            await fs.writeFile(citationFilterPath, CITEPROC_TYPST_FILTER, 'utf8')
        }

        return { manuscriptPath, resourcesDir, tempDir, metadataPath, citationFilterPath }
    }

    private async renderSection(
        section: BookSection,
        transformer: BodyTransformer,
        sectionsToSkip: string[],
        prependPageBreak: PageBreak,
        pageBreakEnabled: boolean,
        partLevel: number,
        chapterLevel: number,
        noteSeparator: InlinedNoteSeparator
    ): Promise<string> {
        const out: string[] = []
        if (prependPageBreak === 'part') out.push(PAGE_BREAK_PART)
        else if (prependPageBreak === 'chapter') out.push(PAGE_BREAK_CHAPTER)
        out.push(`${'#'.repeat(section.level)} ${section.title}`)
        out.push('')

        if (section.prose.length > 0) {
            out.push(convertThematicBreaksToPageBreaks(section.prose, PAGE_BREAK_CHAPTER))
            out.push('')
        }

        let isFirstNote = true
        const subheadingLevel = Math.min(6, section.level + 1)
        for (const ref of section.notes) {
            const inlined = await this.inlineNote(ref, section.level, transformer, sectionsToSkip)
            if (inlined.trim().length === 0) continue
            if (!isFirstNote) {
                const sep = renderNoteSeparator(noteSeparator)
                if (sep !== null) {
                    out.push(sep)
                    out.push('')
                }
            }
            if (noteSeparator === 'subheading') {
                out.push(`${'#'.repeat(subheadingLevel)} ${ref.displayTitle}`)
                out.push('')
            }
            out.push(inlined.trim())
            out.push('')
            isFirstNote = false
        }

        // Each child gets a chapter break unless it is the first chapter under
        // a part (the part break already started a fresh page) or this section
        // is not at the part level.
        let isFirstChapterChild = true
        for (const child of section.children) {
            let childBreak: PageBreak = 'none'
            if (
                pageBreakEnabled &&
                child.level === chapterLevel &&
                section.level === partLevel &&
                partLevel !== chapterLevel
            ) {
                childBreak = isFirstChapterChild ? 'none' : 'chapter'
                isFirstChapterChild = false
            }
            const rendered = await this.renderSection(
                child,
                transformer,
                sectionsToSkip,
                childBreak,
                pageBreakEnabled,
                partLevel,
                chapterLevel,
                noteSeparator
            )
            out.push(rendered)
        }

        return out.join('\n')
    }

    /**
     * Reads the linked note, strips its frontmatter, drops its leading H1,
     * removes any heading whose name is in `sectionsToSkip` (with its body,
     * up to the next same-or-higher heading), demotes remaining headings so
     * they fit beneath the manifest section, and runs the body transformer.
     */
    private async inlineNote(
        ref: NoteReference,
        parentLevel: number,
        transformer: BodyTransformer,
        sectionsToSkip: string[]
    ): Promise<string> {
        const file = this.app.vault.getAbstractFileByPath(ref.filePath)
        if (!(file instanceof TFile)) {
            return `*[Missing note: ${ref.filePath}]*`
        }
        const raw = await this.app.vault.cachedRead(file)
        const body = stripFrontmatter(raw)
        const withoutSkipped = stripSkippedSections(body, sectionsToSkip)
        const headerless = dropFirstH1(withoutSkipped)
        const demoted = demoteHeadings(headerless, parentLevel)
        const pageBroken = convertThematicBreaksToPageBreaks(demoted, PAGE_BREAK_CHAPTER)
        return transformer.transform(pageBroken, file)
    }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type PageBreak = 'none' | 'chapter' | 'part'

function normaliseTitles(titles: string[]): Set<string> {
    return new Set(titles.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0))
}

/**
 * Raw blocks emitted at the very top of the manuscript when at least one
 * top-level section is flagged as front matter. Switches the page numbering
 * to lowercase roman for Typst, and uses pandoc's LaTeX `book` class
 * `\frontmatter` directive (active when `--top-level-division=chapter`,
 * which the runner always passes). HTML/EPUB ignore both.
 */
const FRONT_MATTER_OPEN = [
    '',
    '```{=typst}',
    '#set page(numbering: "i")',
    '```',
    '',
    '```{=latex}',
    '\\frontmatter',
    '```',
    ''
].join('\n')

/**
 * Raw blocks emitted right before the first body-matter section. Resets the
 * Typst page counter to 1 and switches numbering back to arabic; for LaTeX,
 * `\mainmatter` performs the same reset. Includes its own page break — the
 * caller suppresses the surrounding chapter/part break to avoid duplicates.
 */
const BODY_MATTER_OPEN = [
    '',
    '```{=typst}',
    '#pagebreak(to: "odd")',
    '#counter(page).update(1)',
    '#set page(numbering: "1")',
    '```',
    '',
    '```{=latex}',
    '\\mainmatter',
    '```',
    ''
].join('\n')

/**
 * Returns the string emitted between two successive inlined notes inside the
 * same manifest section, based on the configured separator. `null` means
 * "do not emit a separator line at all" (the next note simply follows after
 * the standard blank line between blocks). `subheading` is handled by the
 * caller — this helper only covers the body separator; the heading is
 * emitted separately so the note's display title can drive the level.
 */
function renderNoteSeparator(kind: InlinedNoteSeparator): string | null {
    switch (kind) {
        case 'none':
        case 'subheading':
            return null
        case 'rule':
            // `* * *` is Pandoc's portable thematic-break glyph. Avoids the
            // `---` syntax which the compiler reserves for manual page
            // breaks (see `convertThematicBreaksToPageBreaks`).
            return '* * *'
        case 'blank':
            // An extra blank line on top of the one each block already gets.
            return ''
    }
}

/**
 * Typst-only styling injected at the top of the manuscript so blockquotes
 * read like book pull-quotes instead of stock indented paragraphs, and so
 * images fit the configured page width:
 * - left rule, slight grey on quotes
 * - extra inset, italic body
 * - `#set image(width: <typstImageWidth>)` when the setting is non-empty
 *
 * Pandoc emits the raw block only when the typst writer is selected; LaTeX
 * and HTML/EPUB ignore it. EPUB blockquote styling is handled by the
 * reader's CSS (out of scope for this plugin).
 */
function buildTypstPreamble(settings: PluginSettings): string {
    const lines: string[] = ['```{=typst}']
    const width = settings.typstImageWidth.trim()
    if (width.length > 0) {
        lines.push(`#set image(width: ${width})`)
    }
    lines.push('#show quote.where(block: true): set block(spacing: 1.4em)')
    lines.push('#show quote.where(block: true): it => block(')
    lines.push('  inset: (left: 1.2em, right: 0.2em, top: 0.4em, bottom: 0.4em),')
    lines.push('  stroke: (left: 2pt + luma(70%)),')
    lines.push('  emph(it.body),')
    lines.push(')')
    lines.push('```')
    return lines.join('\n')
}

/**
 * Hard page break before a chapter. Format-conditional raw blocks because
 * Pandoc's typst writer does NOT translate raw LaTeX `\newpage`; it has to
 * see a `{=typst}` block to emit a page break in the PDF.
 */
const PAGE_BREAK_CHAPTER = [
    '',
    '```{=typst}',
    '#pagebreak()',
    '```',
    '',
    '```{=latex}',
    '\\newpage',
    '```',
    '',
    '```{=html}',
    '<div style="page-break-before: always"></div>',
    '```',
    ''
].join('\n')

/**
 * Page break + blank-page-on-recto before a part. Format-conditional raw
 * blocks: typst gets `pagebreak(to: "odd")`, LaTeX gets `\cleardoublepage`,
 * HTML gets a `page-break-before: always` div. Pandoc emits only the block
 * matching the active output format.
 */
const PAGE_BREAK_PART = [
    '',
    '```{=typst}',
    'pagebreak(to: "odd")',
    '```',
    '',
    '```{=latex}',
    '\\cleardoublepage',
    '```',
    '',
    '```{=html}',
    '<div style="page-break-before: always"></div>',
    '```',
    ''
].join('\n')

const FENCE_RE = /^\s*(```|~~~)/

function collectLevels(sections: BookSection[]): number[] {
    const levels = new Set<number>()
    const walk = (list: BookSection[]): void => {
        for (const s of list) {
            levels.add(s.level)
            walk(s.children)
        }
    }
    walk(sections)
    return [...levels]
}

/**
 * Picks the level treated as a "chapter" for page-break purposes. If the
 * manifest uses a single heading level, parts and chapters collapse onto
 * the same level (flat book). Otherwise the chapter level is the next
 * heading depth after parts.
 */
function pickChapterLevel(levels: number[], partLevel: number): number {
    const deeper = levels.filter((l) => l > partLevel)
    if (deeper.length === 0) return partLevel
    return Math.min(...deeper)
}

function dropFirstH1(content: string): string {
    const lines = content.split(/\r?\n/)
    let inFence = false
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (FENCE_RE.test(line)) {
            inFence = !inFence
            continue
        }
        if (inFence) continue
        if (/^#\s+/.test(line)) {
            lines.splice(i, 1)
            return lines.join('\n')
        }
        if (line.trim().length > 0) break
    }
    return content
}

/**
 * Demotes every ATX heading by `parentLevel` so that the linked note's
 * headings sit beneath a manifest heading at level `parentLevel`. Caps at H6.
 */
function demoteHeadings(content: string, parentLevel: number): string {
    const lines = content.split(/\r?\n/)
    let inFence = false
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (FENCE_RE.test(line)) {
            inFence = !inFence
            continue
        }
        if (inFence) continue
        const m = /^(#{1,6})(\s+.*)$/.exec(line)
        if (!m) continue
        const newLevel = Math.min(6, m[1]!.length + parentLevel - 1)
        lines[i] = '#'.repeat(newLevel) + m[2]!
    }
    return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* body transformer                                                    */
/* ------------------------------------------------------------------ */

interface BodyTransformerOptions {
    /** Whether to recursively inline `![[Note]]` embeds. */
    expandNoteEmbeds: boolean
    /** Maximum recursion depth for note-embed expansion. */
    noteEmbedMaxDepth: number
    /** Heading names skipped inside expanded embeds (same as the manifest's). */
    sectionsToSkip: string[]
}

class BodyTransformer {
    private readonly copied = new Map<string, string>()

    constructor(
        private readonly app: App,
        private readonly resourcesDir: string,
        private readonly opts: BodyTransformerOptions
    ) {}

    async transform(
        content: string,
        source: TFile,
        depth = 0,
        visited?: Set<string>
    ): Promise<string> {
        const lines = content.split(/\r?\n/)
        const out: string[] = []
        let inFence = false
        let pendingCallout: { kind: string; title: string } | null = null

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!
            if (FENCE_RE.test(line)) {
                if (pendingCallout !== null) {
                    out.push(':::')
                    pendingCallout = null
                }
                inFence = !inFence
                out.push(line)
                continue
            }
            if (inFence) {
                out.push(line)
                continue
            }

            const callout = matchCalloutOpen(line)
            if (callout !== null) {
                if (pendingCallout !== null) out.push(':::')
                out.push(`::: {.callout .callout-${callout.kind.toLowerCase()}}`)
                if (callout.title.length > 0) out.push(`**${callout.title}**`)
                if (callout.body.length > 0) out.push(callout.body)
                pendingCallout = { kind: callout.kind, title: callout.title }
                continue
            }
            if (pendingCallout !== null) {
                const blockBody = matchCalloutBody(line)
                if (blockBody !== null) {
                    if (blockBody.length > 0) out.push(blockBody)
                    continue
                }
                out.push(':::')
                pendingCallout = null
            }

            const stripped = stripObsidianComments(line)
            const withImages = await this.rewriteImages(stripped, source, depth, visited)
            const withWikilinks = this.rewriteWikilinks(withImages, source)
            out.push(withWikilinks)
        }

        if (pendingCallout !== null) out.push(':::')
        return out.join('\n')
    }

    private async rewriteImages(
        line: string,
        source: TFile,
        depth: number,
        visited: Set<string> | undefined
    ): Promise<string> {
        let result = line
        const wikiImg = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
        result = await replaceAsync(
            result,
            wikiImg,
            async (_match, target: string, alias?: string) => {
                const trimmed = target.trim()
                if (isUrl(trimmed)) {
                    return formatExternalEmbed(trimmed, alias?.trim())
                }
                const copied = await this.copyAsset(trimmed, source)
                if (copied !== null) {
                    const altText = alias?.trim() ?? path.basename(target)
                    return `![${altText}](${copied})`
                }
                // Not an image — try note-embed expansion when enabled.
                const expanded = await this.expandNoteEmbed(
                    trimmed,
                    alias?.trim(),
                    source,
                    depth,
                    visited
                )
                return expanded ?? ''
            }
        )

        const mdImg = /!\[([^\]]*)\]\(([^)\s]+)\)/g
        result = await replaceAsync(result, mdImg, async (_match, alt: string, target: string) => {
            if (isUrl(target)) {
                return formatExternalEmbed(target, alt)
            }
            const copied = await this.copyAsset(decodeURI(target), source)
            if (copied === null) return `![${alt}](${target})`
            return `![${alt}](${copied})`
        })

        return result
    }

    private rewriteWikilinks(line: string, source: TFile): string {
        return line.replace(
            /\[\[([^\]|#^]+)(?:#([^\]|]+))?(?:\^[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
            (_match, linkpath: string, _heading: string | undefined, alias: string | undefined) => {
                const trimmed = linkpath.trim()
                const target = this.app.metadataCache.getFirstLinkpathDest(trimmed, source.path)
                const display =
                    alias?.trim() ||
                    (target instanceof TFile
                        ? target.basename
                        : trimmed.split('/').pop() || trimmed)
                return display
            }
        )
    }

    /**
     * Expands `![[Note]]` (or `![[Note#section]]`, `![[Note|alias]]`) by
     * inlining the target note's body. Honors the plugin's
     * `inlineNoteEmbeds` toggle, applies the configured `noteEmbedMaxDepth`,
     * and tracks `visited` paths to break cycles. Section anchors are not
     * resolved (slicing into a single heading is left as a follow-up); the
     * full note body is inlined in that case.
     *
     * Returns `null` when the embed should not be expanded (feature off,
     * target not a note, anchor only, etc.) so the caller falls back to
     * the legacy "drop the embed" behaviour. Returns a fallback display
     * string (`alias` or basename) when the depth limit is reached or a
     * cycle is detected — the reader still sees a reference, just not the
     * full body.
     */
    private async expandNoteEmbed(
        target: string,
        alias: string | undefined,
        source: TFile,
        depth: number,
        visited: Set<string> | undefined
    ): Promise<string | null> {
        if (!this.opts.expandNoteEmbeds) return null

        // Strip any `#section` / `^block` anchor — we inline the whole note.
        const linkpath = target.split(/[#^]/, 1)[0]?.trim() ?? target
        if (linkpath.length === 0) return null

        const file = this.app.metadataCache.getFirstLinkpathDest(linkpath, source.path)
        if (!(file instanceof TFile)) return null
        if (file.extension.toLowerCase() !== 'md') return null

        const fallbackDisplay = alias ?? file.basename

        if (depth + 1 >= this.opts.noteEmbedMaxDepth) {
            // Bottomed out — render as plain text rather than recursing further.
            return fallbackDisplay
        }
        const seen = visited ?? new Set<string>()
        if (seen.has(file.path)) return fallbackDisplay

        const raw = await this.app.vault.cachedRead(file)
        const body = stripFrontmatter(raw)
        const skipped = stripSkippedSections(body, this.opts.sectionsToSkip)
        const headerless = dropFirstH1(skipped)

        const nextVisited = new Set(seen)
        nextVisited.add(file.path)
        return this.transform(headerless, file, depth + 1, nextVisited)
    }

    private async copyAsset(target: string, source: TFile): Promise<string | null> {
        const cached = this.copied.get(target)
        if (cached !== undefined) return cached

        const file = this.app.metadataCache.getFirstLinkpathDest(target, source.path)
        if (!(file instanceof TFile)) return null

        const ext = file.extension.toLowerCase()
        if (!IMAGE_EXTENSIONS.has(ext)) return null

        const data = await this.app.vault.readBinary(file)
        const safeName = sanitizeAssetName(file.name)
        const dest = path.join(this.resourcesDir, safeName)
        await fs.writeFile(dest, new Uint8Array(data))

        const rel = `_resources/${safeName}`
        this.copied.set(target, rel)
        return rel
    }
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff'])

function isUrl(value: string): boolean {
    return /^https?:\/\//i.test(value)
}

/**
 * Markdown-image syntax with an `http(s)` URL is broken in print exports —
 * Typst can't fetch remote images and the export errors out. Replace these
 * embeds with a plain Markdown link pointing at the URL. YouTube /
 * Vimeo / video URLs get a friendlier label so the printed link is
 * meaningful.
 */
function formatExternalEmbed(url: string, label: string | undefined): string {
    const trimmedLabel = label?.trim() ?? ''
    const platform = videoPlatformFromUrl(url)
    if (platform !== null) {
        const text = trimmedLabel.length > 0 ? trimmedLabel : `Watch on ${platform}`
        return `[${text}](${url})`
    }
    const text = trimmedLabel.length > 0 ? trimmedLabel : url
    return `[${text}](${url})`
}

function videoPlatformFromUrl(url: string): string | null {
    if (/(?:^|\.)youtube\.com\/|(?:^|\.)youtu\.be\//i.test(url)) return 'YouTube'
    if (/(?:^|\.)vimeo\.com\//i.test(url)) return 'Vimeo'
    if (/(?:^|\.)loom\.com\//i.test(url)) return 'Loom'
    return null
}

function sanitizeAssetName(name: string): string {
    return name.replace(/[^A-Za-z0-9._-]/g, '_')
}

function matchCalloutOpen(line: string): { kind: string; title: string; body: string } | null {
    const m = /^>\s*\[!([A-Za-z]+)\][+-]?\s*(.*)$/.exec(line)
    if (!m) return null
    const kind = m[1]!
    const rest = m[2] ?? ''
    return { kind, title: rest.trim(), body: '' }
}

function matchCalloutBody(line: string): string | null {
    if (line.length === 0) return ''
    if (!line.startsWith('>')) return null
    return line.replace(/^>\s?/, '')
}

function stripObsidianComments(line: string): string {
    return line.replace(/%%[\s\S]*?%%/g, '')
}

async function replaceAsync(
    str: string,
    regex: RegExp,
    replacer: (...args: string[]) => Promise<string>
): Promise<string> {
    const tasks: Promise<string>[] = []
    str.replace(regex, (...args: unknown[]) => {
        const stringArgs: string[] = args
            .filter((a): a is string => typeof a === 'string')
            .slice(0, -1)
        tasks.push(replacer(...stringArgs))
        return ''
    })
    const replacements = await Promise.all(tasks)
    let i = 0
    return str.replace(regex, () => replacements[i++] ?? '')
}

/* ------------------------------------------------------------------ */
/* metadata YAML                                                       */
/* ------------------------------------------------------------------ */

/**
 * Temp-dir-relative paths of the citation resources, produced by
 * {@link copyCitationAssets}. Empty when the manifest declares no
 * bibliography.
 */
export interface CitationPaths {
    /** Relative path of the bibliography copy, e.g. `references.bib`. */
    bibliography?: string
    /** Relative path of the CSL stylesheet copy, e.g. `apa.csl`. */
    csl?: string
}

/**
 * Pandoc Lua filter that makes citeproc the single source of truth for
 * citations under the Typst PDF engine. Pandoc's Typst writer renders every
 * citation as a *native* `@key` reference and emits a native
 * `#bibliography("<path>")` directive — even when `--citeproc` already
 * rendered the citations and the reference list. That native directive is the
 * real cause of issue #2: Typst's built-in bibliography reader only accepts
 * BibLaTeX (`.bib`) or Hayagriva (`.yml`), so a CSL-JSON/CSL-YAML bibliography
 * (which citeproc reads happily — hence EPUB works) makes Typst abort with
 * "unknown bibliography format", surfacing as Pandoc's generic "Error 43".
 * Even for a `.bib` it double-renders the reference list (once via citeproc,
 * once via Typst).
 *
 * Running *after* `--citeproc` (the runner orders it so), this filter unwraps
 * each `Cite` element to the inlines citeproc already rendered — so the writer
 * emits plain text instead of a native `@key` — and drops the
 * `bibliography`/`csl` metadata so the template emits no native
 * `#bibliography()` directive. Typst then never reads the bibliography file at
 * all, which removes every format/path/sandbox-root failure mode and matches
 * the citeproc output used by EPUB. See issue #2.
 */
export const CITEPROC_TYPST_FILTER = `-- Generated by obsidian-book-exporter. See issue #2.
-- Runs after --citeproc so citeproc has already rendered citation text and
-- the reference list. Unwrap Cite elements to plain inlines and drop the
-- bibliography/csl metadata so Pandoc's Typst writer emits neither a native
-- @key citation nor a native #bibliography() directive (which only supports
-- .bib/.yml and would otherwise fail or duplicate the reference list).
function Cite(el)
  return el.content
end

function Meta(meta)
  meta.bibliography = nil
  meta.csl = nil
  return meta
end
`

/**
 * Copies the bibliography and CSL files (resolved to absolute filesystem
 * paths by the parser) into `tempDir` and returns their temp-dir-relative
 * paths.
 *
 * Why copy instead of writing the absolute path: citeproc resolves a relative
 * `bibliography:` against Pandoc's working directory, which the runner sets to
 * `tempDir`, so a temp-dir-relative path resolves cleanly regardless of where
 * the vault lives or how the path was spelled. (The Typst native
 * `#bibliography()` directive — historically the source of issue #2 — no
 * longer reads this file at all under the PDF engine; see
 * {@link CITEPROC_TYPST_FILTER}. EPUB and every other format consume the
 * bibliography solely through citeproc.)
 *
 * Falls back to the original absolute path when the copy fails (e.g. the
 * file no longer exists) so the downstream pandoc error stays meaningful.
 */
export async function copyCitationAssets(
    book: ParsedBook,
    tempDir: string
): Promise<CitationPaths> {
    const result: CitationPaths = {}
    const { bibliographyPath, cslPath } = book.metadata
    if (bibliographyPath !== undefined) {
        result.bibliography = await copyCitationAsset(bibliographyPath, tempDir)
    }
    if (cslPath !== undefined) {
        result.csl = await copyCitationAsset(cslPath, tempDir)
    }
    return result
}

async function copyCitationAsset(absPath: string, tempDir: string): Promise<string> {
    const safeName = sanitizeAssetName(path.basename(absPath))
    const dest = path.join(tempDir, safeName)
    try {
        await fs.copyFile(absPath, dest)
        return safeName
    } catch {
        return absPath
    }
}

export function buildMetadataYaml(book: ParsedBook, citations: CitationPaths = {}): string {
    const m = book.metadata
    const lines: string[] = ['---']
    lines.push(`title: ${yamlString(m.title)}`)
    if (m.authors.length === 1) {
        lines.push(`author: ${yamlString(m.authors[0]!)}`)
    } else {
        lines.push('author:')
        for (const a of m.authors) lines.push(`  - ${yamlString(a)}`)
    }
    lines.push(`lang: ${yamlString(m.language)}`)
    if (m.publisher !== undefined) lines.push(`publisher: ${yamlString(m.publisher)}`)
    if (m.datePublished !== undefined) lines.push(`date: ${yamlString(m.datePublished)}`)
    if (m.description !== undefined) lines.push(`description: ${yamlString(m.description)}`)
    if (m.rights !== undefined) lines.push(`rights: ${yamlString(m.rights)}`)
    if (m.isbn !== undefined) lines.push(`identifier: ${yamlString(m.isbn)}`)
    if (m.subject !== undefined && m.subject.length > 0) {
        lines.push('subject:')
        for (const s of m.subject) lines.push(`  - ${yamlString(s)}`)
    }
    const bibliography = citations.bibliography ?? m.bibliographyPath
    if (bibliography !== undefined) {
        lines.push(`bibliography: ${yamlString(bibliography)}`)
    }
    const csl = citations.csl ?? m.cslPath
    if (csl !== undefined) {
        lines.push(`csl: ${yamlString(csl)}`)
    }
    lines.push('---', '')
    return lines.join('\n')
}

function yamlString(value: string): string {
    if (/^[\w .,/'!?:-]+$/u.test(value) && !value.startsWith(':')) {
        return value
    }
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
