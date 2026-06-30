/**
 * Pure Markdown helpers shared across the parser and the compiler.
 * No Obsidian / Node imports — keep this module dependency-free so it
 * stays trivially unit-testable.
 */

/**
 * Matches the opening (or closing) line of a fenced code block — ` ``` ` or
 * `~~~`, optionally indented. Shared by every line-walking pass so fenced
 * content is treated consistently across the parser and compiler.
 */
export const FENCE_RE = /^\s*(```|~~~)/
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/

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

        const heading = HEADING_RE.exec(line)
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

/**
 * Removes Obsidian `%% … %%` comments from `body`, including comments that
 * span multiple lines. Fenced code blocks are preserved verbatim — a `%%`
 * inside a code fence is left untouched. Comment delimiters are matched even
 * mid-line (`text %% note %% more` → `text  more`); a multi-line comment's
 * interior lines collapse to blank lines so surrounding block structure is
 * kept.
 *
 * Replaces the previous per-line strip, which silently leaked any comment
 * spanning more than one line (see issue #11).
 */
export function stripObsidianComments(body: string): string {
    const lines = body.split(/\r?\n/)
    let inFence = false
    let inComment = false
    const out: string[] = []

    for (const line of lines) {
        // A fence toggle only counts outside a comment.
        if (!inComment && FENCE_RE.test(line)) {
            inFence = !inFence
            out.push(line)
            continue
        }
        if (inFence) {
            out.push(line)
            continue
        }

        let result = ''
        let i = 0
        while (i < line.length) {
            if (line.startsWith('%%', i)) {
                inComment = !inComment
                i += 2
                continue
            }
            if (!inComment) result += line[i]
            i++
        }
        out.push(result)
    }

    return out.join('\n')
}

/**
 * Anchor of an embed/wikilink target. A `^block` reference points at a single
 * block; a `#heading` (optionally a `#a#b` chain) points at a heading section.
 */
export type EmbedAnchor =
    | { type: 'block'; blockId: string }
    | { type: 'heading'; headingPath: string[] }

/**
 * Splits an embed target into the note linkpath and its optional anchor.
 * Handles both Obsidian block syntax (`Note#^id`) and the looser `Note^id`,
 * heading sections (`Note#Heading`), and heading chains (`Note#H1#H2`).
 * Returns `anchor: null` when there is no anchor (or only an empty one), so the
 * caller inlines the whole note.
 */
export function parseEmbedTarget(target: string): { linkpath: string; anchor: EmbedAnchor | null } {
    const delim = /[#^]/.exec(target)
    if (delim === null) return { linkpath: target.trim(), anchor: null }

    const linkpath = target.slice(0, delim.index).trim()
    const rest = target.slice(delim.index)

    // Block reference: `^id` directly, or `#^id`.
    const blockMatch = /^#?\^(.+)$/.exec(rest)
    if (blockMatch !== null) {
        const blockId = blockMatch[1]!.trim()
        return { linkpath, anchor: blockId.length > 0 ? { type: 'block', blockId } : null }
    }

    // Heading section (possibly a `#a#b` chain into a subheading).
    const headingPath = rest
        .slice(1)
        .split('#')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    if (headingPath.length === 0) return { linkpath, anchor: null }
    return { linkpath, anchor: { type: 'heading', headingPath } }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extracts the single block tagged with `^blockId` from a note body (Obsidian
 * block reference). The id may sit at the end of a block's last line
 * (`text ^id`) or alone on the line after the block. The surrounding
 * contiguous (blank-line-delimited) lines form the block; the `^id` marker is
 * removed from the output. Returns `null` when the id isn't found, so the
 * caller can fall back rather than inlining the whole note (issue #50).
 */
export function extractBlock(body: string, blockId: string): string | null {
    if (blockId.length === 0) return null
    const lines = body.split(/\r?\n/)
    const marker = new RegExp(`(?:^|\\s)\\^${escapeRegExp(blockId)}\\s*$`)

    let markerIdx = -1
    let inFence = false
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (FENCE_RE.test(line)) {
            inFence = !inFence
            continue
        }
        if (!inFence && marker.test(line)) {
            markerIdx = i
            break
        }
    }
    if (markerIdx === -1) return null

    const standalone = lines[markerIdx]!.trim() === `^${blockId}`
    if (standalone) {
        // The id is on its own line; the block is the preceding paragraph.
        let start = markerIdx - 1
        while (start >= 0 && lines[start]!.trim() !== '') start--
        const text = lines.slice(start + 1, markerIdx).join('\n').trim()
        return text.length > 0 ? text : null
    }

    // The id is appended to the block's last line; expand to the whole block.
    let start = markerIdx
    while (start - 1 >= 0 && lines[start - 1]!.trim() !== '') start--
    let end = markerIdx
    while (end + 1 < lines.length && lines[end + 1]!.trim() !== '') end++

    const block = lines.slice(start, end + 1)
    const rel = markerIdx - start
    block[rel] = block[rel]!.replace(new RegExp(`\\s*\\^${escapeRegExp(blockId)}\\s*$`), '')
    const text = block.join('\n').trim()
    return text.length > 0 ? text : null
}

/**
 * Extracts the section under the heading named by `headingPath` (the heading
 * line itself plus everything down to the next heading of the same or higher
 * level). A multi-element path drills into subheadings (`Note#H1#H2`). Heading
 * matching is case-insensitive. Code fences are respected so a `#` inside a
 * fence is never mistaken for a heading. Returns `null` when the heading isn't
 * found (issue #50).
 */
export function extractSection(body: string, headingPath: string[]): string | null {
    return sliceSection(body.split(/\r?\n/), headingPath)
}

function sliceSection(lines: string[], headingPath: string[]): string | null {
    const wanted = headingPath[0]?.trim().toLowerCase()
    if (wanted === undefined) return null

    let startIdx = -1
    let level = 0
    let inFence = false
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (FENCE_RE.test(line)) {
            inFence = !inFence
            continue
        }
        if (inFence) continue
        const heading = HEADING_RE.exec(line)
        if (heading !== null && heading[2]!.trim().toLowerCase() === wanted) {
            startIdx = i
            level = heading[1]!.length
            break
        }
    }
    if (startIdx === -1) return null

    let endIdx = lines.length
    inFence = false
    for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i]!
        if (FENCE_RE.test(line)) {
            inFence = !inFence
            continue
        }
        if (inFence) continue
        const heading = HEADING_RE.exec(line)
        if (heading !== null && heading[1]!.length <= level) {
            endIdx = i
            break
        }
    }

    const section = lines.slice(startIdx, endIdx)
    const rest = headingPath.slice(1)
    if (rest.length === 0) return section.join('\n').trim()
    return sliceSection(section, rest)
}

const HR_RE = /^\s*-{3,}\s*$/

/**
 * Converts standalone `---` (3+ dash) lines into the caller's `pageBreak`
 * literal (a Pandoc raw block that produces a page break per output
 * format). Frontmatter must already be stripped (the YAML delimiters use
 * the same syntax). Code fences are preserved.
 */
export function convertThematicBreaksToPageBreaks(body: string, pageBreak: string): string {
    const lines = body.split(/\r?\n/)
    let inFence = false
    const out: string[] = []
    for (const line of lines) {
        if (FENCE_RE.test(line)) {
            inFence = !inFence
            out.push(line)
            continue
        }
        if (inFence) {
            out.push(line)
            continue
        }
        if (HR_RE.test(line)) {
            out.push(pageBreak)
        } else {
            out.push(line)
        }
    }
    return out.join('\n')
}
