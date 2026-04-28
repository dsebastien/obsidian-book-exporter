import { TFile, type App } from 'obsidian'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { BookSection, NoteReference, ParsedBook } from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { stripFrontmatter } from './book-parser'

export interface CompiledManuscript {
    /** Absolute path of the combined `.md` file. */
    manuscriptPath: string
    /** Absolute path of the image-resources folder. */
    resourcesDir: string
    /** Absolute path of the temp dir holding both. Caller can delete after use. */
    tempDir: string
    /** Pandoc YAML metadata file (absolute path). */
    metadataPath: string
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
        const transformer = new BodyTransformer(this.app, resourcesDir)
        const pageBreak =
            book.overrides.pageBreakPerChapter ?? this.settings.pageBreakPerChapterDefault
        const breakLevel = lowestSectionLevel(book.sections)

        const parts: string[] = []
        parts.push(`# ${book.metadata.title}`)
        parts.push('')

        let isFirstTopLevel = true
        for (const section of book.sections) {
            const rendered = await this.renderSection(
                section,
                transformer,
                sectionsToSkip,
                pageBreak && breakLevel !== null && section.level === breakLevel && !isFirstTopLevel
            )
            parts.push(rendered)
            isFirstTopLevel = false
        }

        const manuscriptPath = path.join(tempDir, 'manuscript.md')
        await fs.writeFile(manuscriptPath, parts.join('\n').trim() + '\n', 'utf8')

        const metadataPath = path.join(tempDir, 'metadata.yaml')
        await fs.writeFile(metadataPath, buildMetadataYaml(book), 'utf8')

        return { manuscriptPath, resourcesDir, tempDir, metadataPath }
    }

    private async renderSection(
        section: BookSection,
        transformer: BodyTransformer,
        sectionsToSkip: string[],
        prependPageBreak: boolean
    ): Promise<string> {
        const out: string[] = []
        if (prependPageBreak) out.push(PAGE_BREAK)
        out.push(`${'#'.repeat(section.level)} ${section.title}`)
        out.push('')

        for (const ref of section.notes) {
            const inlined = await this.inlineNote(ref, section.level, transformer, sectionsToSkip)
            if (inlined.trim().length > 0) {
                out.push(inlined.trim())
                out.push('')
            }
        }

        for (const child of section.children) {
            const rendered = await this.renderSection(child, transformer, sectionsToSkip, false)
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
        return transformer.transform(demoted, file)
    }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const PAGE_BREAK = '\n\\newpage\n'
const FENCE_RE = /^\s*(```|~~~)/

function lowestSectionLevel(sections: BookSection[]): number | null {
    let lowest: number | null = null
    for (const section of sections) {
        if (lowest === null || section.level < lowest) lowest = section.level
    }
    return lowest
}

/**
 * Walks `body` line-by-line. When a heading whose text matches an entry in
 * `skip` (case-insensitive) is encountered, the heading and every line that
 * follows are dropped until a heading at the same-or-higher level appears.
 * Code fences are preserved.
 */
export function stripSkippedSections(body: string, skip: string[]): string {
    if (skip.length === 0) return body
    const skipSet = new Set(skip.map((s) => s.trim().toLowerCase()))
    const lines = body.split(/\r?\n/)
    const out: string[] = []
    let inFence = false
    let skipLevel: number | null = null

    for (const line of lines) {
        if (FENCE_RE.test(line)) {
            inFence = !inFence
            if (skipLevel === null) out.push(line)
            continue
        }
        if (inFence) {
            if (skipLevel === null) out.push(line)
            continue
        }

        const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
        if (heading !== null) {
            const level = heading[1]!.length
            const text = heading[2]!.trim().toLowerCase()
            if (skipLevel !== null && level <= skipLevel) {
                skipLevel = null
            }
            if (skipLevel === null) {
                if (skipSet.has(text)) {
                    skipLevel = level
                    continue
                }
                out.push(line)
            }
            continue
        }
        if (skipLevel === null) out.push(line)
    }
    return out.join('\n')
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

class BodyTransformer {
    private readonly copied = new Map<string, string>()

    constructor(
        private readonly app: App,
        private readonly resourcesDir: string
    ) {}

    async transform(content: string, source: TFile): Promise<string> {
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
            const withImages = await this.rewriteImages(stripped, source)
            const withWikilinks = this.rewriteWikilinks(withImages, source)
            out.push(withWikilinks)
        }

        if (pendingCallout !== null) out.push(':::')
        return out.join('\n')
    }

    private async rewriteImages(line: string, source: TFile): Promise<string> {
        let result = line
        const wikiImg = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
        result = await replaceAsync(result, wikiImg, async (_match, target: string, alias?: string) => {
            const copied = await this.copyAsset(target.trim(), source)
            if (copied === null) return ''
            const altText = alias?.trim() ?? path.basename(target)
            return `![${altText}](${copied})`
        })

        const mdImg = /!\[([^\]]*)\]\(([^)\s]+)\)/g
        result = await replaceAsync(result, mdImg, async (_match, alt: string, target: string) => {
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
                    (target instanceof TFile ? target.basename : trimmed.split('/').pop() || trimmed)
                return display
            }
        )
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

export function buildMetadataYaml(book: ParsedBook): string {
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
    lines.push('---', '')
    return lines.join('\n')
}

function yamlString(value: string): string {
    if (/^[\w .,/'!?:-]+$/u.test(value) && !value.startsWith(':')) {
        return value
    }
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
