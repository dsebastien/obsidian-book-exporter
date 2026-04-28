import { TFile, type App } from 'obsidian'
import type {
    BookExportOverrides,
    BookMetadata,
    BookSection,
    ExportFormat,
    NoteReference,
    ParsedBook,
    PdfEngine
} from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { stripFrontmatter, stripSkippedSections } from '../../utils/markdown'

/**
 * Parses a manifest note into a {@link ParsedBook}.
 *
 * Contract:
 * - The first `# H1` in the body (or the frontmatter `title`, or the note's
 *   basename) is the book title.
 * - Every `##`..`######` heading creates a {@link BookSection} at the matching
 *   level, nested under the previous higher-level section.
 * - Every bullet under a section that contains one or more wikilinks
 *   contributes its wikilinks (in source order) to that section's note list.
 * - Bullets without wikilinks are ignored. Bullet text around the wikilink is
 *   considered author commentary and dropped.
 * - Code fences are skipped during parsing.
 *
 * The parser is the only service that knows about Obsidian's `MetadataCache`.
 * Everything downstream (compiler, validator, exporter) takes a `ParsedBook`.
 */
export class BookParser {
    constructor(
        private readonly app: App,
        private readonly settings: PluginSettings
    ) {}

    async parse(file: TFile): Promise<ParsedBook> {
        const cache = this.app.metadataCache.getFileCache(file)
        if (!cache) {
            throw new Error(`Could not read metadata cache for ${file.path}`)
        }
        const fm = cache.frontmatter ?? {}
        const raw = await this.app.vault.cachedRead(file)
        const body = stripFrontmatter(raw)

        const overrides = extractOverrides(fm)
        const skip = overrides.sectionsToSkip ?? this.settings.sectionsToSkip
        const cleanBody = stripSkippedSections(body, skip)

        const { sections, bodyTitle } = this.parseBody(cleanBody, file)
        const metadata = this.extractMetadata(fm, file, bodyTitle)

        return {
            bookNotePath: file.path,
            metadata,
            overrides,
            sections
        }
    }

    private parseBody(
        body: string,
        source: TFile
    ): { sections: BookSection[]; bodyTitle: string | undefined } {
        const lines = body.split(/\r?\n/)
        const root: BookSection = { level: 1, title: '', notes: [], children: [] }
        const stack: BookSection[] = [root]
        let bodyTitle: string | undefined
        let inFence = false

        for (const line of lines) {
            if (FENCE_RE.test(line)) {
                inFence = !inFence
                continue
            }
            if (inFence) continue

            const heading = matchHeading(line)
            if (heading !== null) {
                if (heading.level === 1) {
                    if (bodyTitle === undefined) bodyTitle = heading.text.trim()
                    continue
                }
                while (
                    stack.length > 1 &&
                    stack[stack.length - 1]!.level >= heading.level
                ) {
                    stack.pop()
                }
                const section: BookSection = {
                    level: heading.level,
                    title: heading.text.trim(),
                    notes: [],
                    children: []
                }
                stack[stack.length - 1]!.children.push(section)
                stack.push(section)
                continue
            }

            const bullet = matchBullet(line)
            if (bullet === null) continue
            if (stack.length === 1) continue

            const links = matchAllWikilinks(bullet.text)
            if (links.length === 0) continue
            const current = stack[stack.length - 1]!
            for (const link of links) {
                current.notes.push(this.resolveLink(link, source))
            }
        }

        return { sections: root.children, bodyTitle }
    }

    private resolveLink(
        link: { linkpath: string; alias?: string },
        source: TFile
    ): NoteReference {
        const target = this.app.metadataCache.getFirstLinkpathDest(link.linkpath, source.path)
        const filePath = target instanceof TFile ? target.path : link.linkpath
        const displayTitle =
            link.alias?.trim() ||
            (target instanceof TFile ? target.basename : basenameFromLinkpath(link.linkpath))
        return { filePath, displayTitle }
    }

    private extractMetadata(
        fm: Record<string, unknown>,
        file: TFile,
        bodyTitle: string | undefined
    ): BookMetadata {
        const fmTitle = asString(fm['title'])
        const title =
            fmTitle ??
            bodyTitle?.replace(/\s*\(Book\)\s*$/i, '').trim() ??
            file.basename.replace(/\s*\(Book\)\s*$/i, '').trim()
        const fmAuthors = asStringList(fm['authors'])
        const authors = fmAuthors.length > 0 ? fmAuthors : this.settings.defaultAuthors
        const language = asString(fm['language']) ?? this.settings.defaultLanguage

        const isbn = asString(fm['isbn'])
        const publisher = asString(fm['publisher'])
        const datePublished = asString(fm['date_published'])
        const description = asString(fm['description'])
        const rights = asString(fm['rights'])
        const subject = asStringList(fm['subject'])

        const cover = this.resolveCover(asString(fm['cover']), file)

        return {
            title,
            authors: authors.length > 0 ? authors : ['Anonymous'],
            language,
            ...(isbn !== undefined && { isbn }),
            ...(publisher !== undefined && { publisher }),
            ...(datePublished !== undefined && { datePublished }),
            ...(description !== undefined && { description }),
            ...(rights !== undefined && { rights }),
            ...(subject.length > 0 && { subject }),
            ...(cover !== undefined && { coverPath: cover })
        }
    }

    /**
     * Tries to resolve `cover` from the manifest frontmatter into an absolute
     * filesystem path. Accepts: vault-relative paths, plain attachment names,
     * and absolute paths.
     */
    private resolveCover(value: string | undefined, source: TFile): string | undefined {
        if (value === undefined || value.length === 0) return undefined

        const stripped = value.replace(/^\[\[|\]\]$/g, '').trim()

        const direct = this.app.vault.getAbstractFileByPath(stripped)
        if (direct instanceof TFile) {
            return this.toAbsolutePath(direct.path)
        }

        const linked = this.app.metadataCache.getFirstLinkpathDest(stripped, source.path)
        if (linked instanceof TFile) {
            return this.toAbsolutePath(linked.path)
        }

        if (stripped.startsWith('/') || /^[A-Za-z]:[\\/]/.test(stripped)) {
            return stripped
        }
        return undefined
    }

    private toAbsolutePath(vaultRelative: string): string | undefined {
        const adapter = this.app.vault.adapter
        const getFullPath = (adapter as { getFullPath?: (p: string) => string }).getFullPath
        if (typeof getFullPath === 'function') {
            return getFullPath.call(adapter, vaultRelative)
        }
        return undefined
    }
}

/* ------------------------------------------------------------------ */
/* internals                                                           */
/* ------------------------------------------------------------------ */

const FENCE_RE = /^\s*(```|~~~)/
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/
const BULLET_RE = /^(\s*)(?:[-*+])\s+(.*)$/
const WIKILINK_RE = /\[\[([^\]|#^]+)(?:#[^\]|]+)?(?:\^[^\]|]+)?(?:\|([^\]]+))?\]\]/g

function matchHeading(line: string): { level: number; text: string } | null {
    const m = HEADING_RE.exec(line)
    if (!m) return null
    return { level: m[1]!.length, text: m[2]! }
}

function matchBullet(line: string): { text: string } | null {
    const m = BULLET_RE.exec(line)
    if (!m) return null
    return { text: m[2]! }
}

function matchAllWikilinks(text: string): { linkpath: string; alias?: string }[] {
    const out: { linkpath: string; alias?: string }[] = []
    let m: RegExpExecArray | null
    WIKILINK_RE.lastIndex = 0
    while ((m = WIKILINK_RE.exec(text)) !== null) {
        const linkpath = m[1]!.trim()
        const alias = m[2]?.trim()
        out.push(alias !== undefined && alias.length > 0 ? { linkpath, alias } : { linkpath })
    }
    return out
}

function basenameFromLinkpath(linkpath: string): string {
    const last = linkpath.split('/').pop() ?? linkpath
    return last.replace(/\.md$/i, '')
}

function extractOverrides(fm: Record<string, unknown>): BookExportOverrides {
    const raw = fm['book_export']
    if (raw === undefined || raw === null || typeof raw !== 'object') return {}
    const r = raw as Record<string, unknown>

    const overrides: BookExportOverrides = {}
    const outputDir = asString(r['output_dir'])
    if (outputDir !== undefined) overrides.outputDir = outputDir

    const pdfEngine = asString(r['pdf_engine'])
    if (pdfEngine !== undefined && isPdfEngine(pdfEngine)) overrides.pdfEngine = pdfEngine

    const tocDepth = asNumber(r['toc_depth'])
    if (tocDepth !== undefined) overrides.tocDepth = tocDepth

    const includeToc = asBoolean(r['include_toc'])
    if (includeToc !== undefined) overrides.includeToc = includeToc

    const pageBreak = asBoolean(r['page_break_per_chapter'])
    if (pageBreak !== undefined) overrides.pageBreakPerChapter = pageBreak

    const formats = asStringList(r['formats']).filter(isExportFormat)
    if (formats.length > 0) overrides.formats = formats

    const extraArgs = asStringList(r['pandoc_extra_args'])
    if (extraArgs.length > 0) overrides.pandocExtraArgs = extraArgs

    const sectionsToSkip = asStringList(r['sections_to_skip'])
    if (sectionsToSkip.length > 0) overrides.sectionsToSkip = sectionsToSkip

    return overrides
}

function asString(v: unknown): string | undefined {
    if (typeof v === 'string') {
        const t = v.trim()
        return t.length > 0 ? t : undefined
    }
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return undefined
}

function asNumber(v: unknown): number | undefined {
    if (typeof v === 'number' && !Number.isNaN(v)) return v
    if (typeof v === 'string' && v.trim().length > 0) {
        const n = Number(v)
        if (!Number.isNaN(n)) return n
    }
    return undefined
}

function asBoolean(v: unknown): boolean | undefined {
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') {
        const t = v.trim().toLowerCase()
        if (t === 'true') return true
        if (t === 'false') return false
    }
    return undefined
}

function asStringList(v: unknown): string[] {
    if (Array.isArray(v)) {
        return v
            .map((item) => asString(item))
            .filter((item): item is string => typeof item === 'string')
    }
    if (typeof v === 'string') {
        const t = v.trim()
        return t.length > 0 ? [t] : []
    }
    return []
}

function isPdfEngine(v: string): v is PdfEngine {
    return ['typst', 'weasyprint', 'xelatex', 'tectonic', 'wkhtmltopdf'].includes(v)
}

function isExportFormat(v: string): v is ExportFormat {
    return v === 'epub' || v === 'pdf'
}
