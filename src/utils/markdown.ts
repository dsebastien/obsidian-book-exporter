/**
 * Pure Markdown helpers shared across the parser and the compiler.
 * No Obsidian / Node imports — keep this module dependency-free so it
 * stays trivially unit-testable.
 */

const FENCE_RE = /^\s*(```|~~~)/
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
