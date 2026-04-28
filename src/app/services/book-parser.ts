import { TFile, type App, type CachedMetadata } from 'obsidian'
import type {
    BookEntry,
    BookExportOverrides,
    BookMetadata,
    ExportFormat,
    ParsedBook,
    PdfEngine
} from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'

/**
 * Parses a book note (the manifest) into a {@link ParsedBook}.
 *
 * The parser is the only place that knows about Obsidian's `MetadataCache`.
 * Everything downstream (compiler, validator, exporter) takes a `ParsedBook`.
 */
export class BookParser {
    constructor(
        private readonly app: App,
        private readonly settings: PluginSettings
    ) {}

    /**
     * Returns true when the given file looks like a book note. We test for the
     * own-books mandatory tag (`type/creation/book`). Frontmatter `tags`
     * (string or list) and inline `#tags` are both honoured by Obsidian's
     * cache, so we read it from there.
     */
    isBookNote(file: TFile): boolean {
        const cache = this.app.metadataCache.getFileCache(file)
        if (!cache) return false
        const fmTags = collectTags(cache)
        return fmTags.has('type/creation/book')
    }

    async parse(file: TFile): Promise<ParsedBook> {
        const cache = this.app.metadataCache.getFileCache(file)
        if (!cache) {
            throw new Error(`Could not read metadata cache for ${file.path}`)
        }
        const fm = cache.frontmatter ?? {}
        const body = await this.readBodyWithoutFrontmatter(file)

        const metadata = this.extractMetadata(fm, file)
        const overrides = extractOverrides(fm)

        const sections = this.parseTocSections(body)
        const frontMatter = sections.front.map((entry) => this.resolveEntry(entry, file))
        const chapters = sections.chapters.map((entry) => this.resolveEntry(entry, file))
        const backMatter = sections.back.map((entry) => this.resolveEntry(entry, file))

        return {
            bookNotePath: file.path,
            metadata,
            overrides,
            frontMatter,
            chapters,
            backMatter
        }
    }

    private async readBodyWithoutFrontmatter(file: TFile): Promise<string> {
        const raw = await this.app.vault.cachedRead(file)
        return stripFrontmatter(raw)
    }

    private extractMetadata(fm: Record<string, unknown>, file: TFile): BookMetadata {
        const title =
            asString(fm['title']) ?? file.basename.replace(/\s*\(Book\)\s*$/i, '').trim()
        const authors = asStringList(fm['authors'])
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
     * Walks the body once and pulls out the bullet lists that follow each
     * recognised heading. Code fences are skipped entirely.
     */
    private parseTocSections(body: string): {
        front: RawEntry[]
        chapters: RawEntry[]
        back: RawEntry[]
    } {
        const want: Record<'front' | 'chapters' | 'back', string> = {
            front: this.settings.frontMatterHeading.trim().toLowerCase(),
            chapters: this.settings.chaptersHeading.trim().toLowerCase(),
            back: this.settings.backMatterHeading.trim().toLowerCase()
        }

        const lines = body.split(/\r?\n/)
        let inFence = false
        let active: 'front' | 'chapters' | 'back' | null = null
        const buckets: { front: RawEntry[]; chapters: RawEntry[]; back: RawEntry[] } = {
            front: [],
            chapters: [],
            back: []
        }
        let lastTopLevel: RawEntry | null = null

        for (const line of lines) {
            if (FENCE_RE.test(line)) {
                inFence = !inFence
                continue
            }
            if (inFence) continue

            const heading = matchHeading(line)
            if (heading !== null) {
                const lower = heading.text.trim().toLowerCase()
                if (lower === want.front) active = 'front'
                else if (lower === want.chapters) active = 'chapters'
                else if (lower === want.back) active = 'back'
                else active = null
                lastTopLevel = null
                continue
            }

            if (active === null) continue

            const bullet = matchBullet(line)
            if (bullet === null) continue

            const link = matchFirstWikilink(bullet.text)
            if (link === null) continue

            const entry: RawEntry = { ...link, sections: [] }
            if (bullet.indent === 0) {
                buckets[active].push(entry)
                lastTopLevel = active === 'chapters' ? entry : null
            } else if (active === 'chapters' && lastTopLevel !== null) {
                lastTopLevel.sections.push(entry)
            }
            // Nested entries under non-chapter sections are ignored on purpose.
        }

        return buckets
    }

    private resolveEntry(raw: RawEntry, source: TFile): BookEntry {
        const target = this.app.metadataCache.getFirstLinkpathDest(raw.linkpath, source.path)
        const filePath = target instanceof TFile ? target.path : raw.linkpath
        const displayTitle =
            raw.alias?.trim() ||
            (target instanceof TFile ? target.basename : basenameFromLinkpath(raw.linkpath))
        return {
            filePath,
            displayTitle,
            sections: raw.sections.map((s) => this.resolveEntry(s, source))
        }
    }

    /**
     * Tries to resolve `cover` from the book frontmatter into an absolute
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

interface RawEntry {
    linkpath: string
    alias?: string
    sections: RawEntry[]
}

const FENCE_RE = /^\s*(```|~~~)/
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/
const BULLET_RE = /^(\s*)(?:[-*+])\s+(.*)$/
const WIKILINK_RE = /\[\[([^\]|#^]+)(?:#[^\]|]+)?(?:\^[^\]|]+)?(?:\|([^\]]+))?\]\]/

function matchHeading(line: string): { level: number; text: string } | null {
    const m = HEADING_RE.exec(line)
    if (!m) return null
    return { level: m[1]!.length, text: m[2]! }
}

function matchBullet(line: string): { indent: number; text: string } | null {
    const m = BULLET_RE.exec(line)
    if (!m) return null
    const indent = Math.floor(m[1]!.length / 2)
    return { indent, text: m[2]! }
}

function matchFirstWikilink(text: string): { linkpath: string; alias?: string } | null {
    const m = WIKILINK_RE.exec(text)
    if (!m) return null
    const linkpath = m[1]!.trim()
    const alias = m[2]?.trim()
    return alias !== undefined && alias.length > 0 ? { linkpath, alias } : { linkpath }
}

function basenameFromLinkpath(linkpath: string): string {
    const last = linkpath.split('/').pop() ?? linkpath
    return last.replace(/\.md$/i, '')
}

function collectTags(cache: CachedMetadata): Set<string> {
    const out = new Set<string>()
    const fmTags = cache.frontmatter?.['tags']
    if (Array.isArray(fmTags)) {
        for (const tag of fmTags) {
            if (typeof tag === 'string') out.add(tag.replace(/^#/, ''))
        }
    } else if (typeof fmTags === 'string') {
        for (const tag of fmTags.split(/[\s,]+/)) {
            if (tag.length > 0) out.add(tag.replace(/^#/, ''))
        }
    }
    if (cache.tags) {
        for (const tag of cache.tags) out.add(tag.tag.replace(/^#/, ''))
    }
    return out
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
    return ['xelatex', 'weasyprint', 'wkhtmltopdf', 'tectonic', 'typst'].includes(v)
}

function isExportFormat(v: string): v is ExportFormat {
    return v === 'epub' || v === 'pdf' || v === 'mobi'
}

/**
 * Strips a leading YAML frontmatter block (between `---` lines) from a raw
 * note string. Returns the body unchanged when there is no frontmatter.
 */
export function stripFrontmatter(raw: string): string {
    if (!raw.startsWith('---')) return raw
    const rest = raw.slice(3)
    const end = rest.search(/\n---\s*(\r?\n|$)/)
    if (end === -1) return raw
    const after = rest.slice(end).replace(/^\n---\s*(\r?\n|$)/, '')
    return after
}
