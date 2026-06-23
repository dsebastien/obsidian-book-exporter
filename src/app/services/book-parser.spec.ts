import { describe, expect, it } from 'bun:test'
import { TFile, type App } from 'obsidian'
import { BookParser } from './book-parser'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'

function makeFile(p: string): TFile {
    const name = p.split('/').pop() ?? p
    const dot = name.lastIndexOf('.')
    const extension = dot >= 0 ? name.slice(dot + 1) : ''
    const basename = dot >= 0 ? name.slice(0, dot) : name
    return Object.assign(new TFile(), { path: p, name, extension, basename })
}

/**
 * Builds a BookParser over a mock vault. `links` maps a wikilink target to the
 * resolved note path; `frontmatter` is the manifest note's frontmatter.
 */
function makeParser(
    raw: string,
    frontmatter: Record<string, unknown> = {},
    links: Record<string, string> = {}
): BookParser {
    const app = {
        metadataCache: {
            getFileCache: () => ({ frontmatter }),
            getFirstLinkpathDest: (lp: string): TFile | null =>
                lp in links ? makeFile(links[lp]!) : null
        },
        vault: {
            cachedRead: () => Promise.resolve(raw)
        }
    } as unknown as App
    return new BookParser(app, DEFAULT_SETTINGS)
}

describe('BookParser title resolution', () => {
    it('prefers the frontmatter title', async () => {
        const book = await makeParser(
            '# H1 Title\n## S\n- [[N]]',
            { title: 'FM Title' },
            {
                N: 'N.md'
            }
        ).parse(makeFile('Book.md'))
        expect(book.metadata.title).toBe('FM Title')
    })

    it('falls back to the first H1 and strips a trailing (Book)', async () => {
        const book = await makeParser('# My Book (Book)\n## S\n- [[N]]', {}, { N: 'N.md' }).parse(
            makeFile('Book.md')
        )
        expect(book.metadata.title).toBe('My Book')
    })

    it('falls back to the note basename when there is no H1 or frontmatter title', async () => {
        const book = await makeParser('## S\n- [[N]]', {}, { N: 'N.md' }).parse(
            makeFile('My Manuscript (Book).md')
        )
        expect(book.metadata.title).toBe('My Manuscript')
    })
})

describe('BookParser structure', () => {
    it('nests sections by heading level', async () => {
        const raw = ['## A', '- [[N1]]', '### A1', '- [[N2]]', '## B', '- [[N3]]'].join('\n')
        const book = await makeParser(raw, {}, { N1: 'N1.md', N2: 'N2.md', N3: 'N3.md' }).parse(
            makeFile('Book.md')
        )
        expect(book.sections.map((s) => s.title)).toEqual(['A', 'B'])
        const a = book.sections[0]!
        expect(a.notes.map((n) => n.filePath)).toEqual(['N1.md'])
        expect(a.children.map((c) => c.title)).toEqual(['A1'])
        expect(a.children[0]!.notes.map((n) => n.filePath)).toEqual(['N2.md'])
        expect(book.sections[1]!.notes.map((n) => n.filePath)).toEqual(['N3.md'])
    })

    it('extracts wikilinks from bullets and keeps plain bullets as prose', async () => {
        const raw = ['## A', '- [[N1]]', '- just a note to self', 'a paragraph'].join('\n')
        const book = await makeParser(raw, {}, { N1: 'N1.md' }).parse(makeFile('Book.md'))
        const a = book.sections[0]!
        expect(a.notes.map((n) => n.filePath)).toEqual(['N1.md'])
        expect(a.prose).toContain('just a note to self')
        expect(a.prose).toContain('a paragraph')
    })

    it('ignores headings inside fenced code blocks', async () => {
        const raw = ['## A', '```', '## NotASection', '```', '- [[N1]]'].join('\n')
        const book = await makeParser(raw, {}, { N1: 'N1.md' }).parse(makeFile('Book.md'))
        expect(book.sections.map((s) => s.title)).toEqual(['A'])
        expect(book.sections[0]!.notes.map((n) => n.filePath)).toEqual(['N1.md'])
    })

    it('uses a wikilink alias as the display title', async () => {
        const book = await makeParser('## A\n- [[N1|Chapter One]]', {}, { N1: 'N1.md' }).parse(
            makeFile('Book.md')
        )
        expect(book.sections[0]!.notes[0]!.displayTitle).toBe('Chapter One')
    })
})

describe('BookParser overrides', () => {
    it('reads book_export overrides from frontmatter', async () => {
        const fm = {
            book_export: {
                formats: ['pdf'],
                pdf_engine: 'xelatex',
                number_sections: true,
                output_dir: '~/Books'
            }
        }
        const book = await makeParser('## A\n- [[N1]]', fm, { N1: 'N1.md' }).parse(
            makeFile('Book.md')
        )
        expect(book.overrides.formats).toEqual(['pdf'])
        expect(book.overrides.pdfEngine).toBe('xelatex')
        expect(book.overrides.numberSections).toBe(true)
        expect(book.overrides.outputDir).toBe('~/Books')
    })

    it('returns empty overrides when book_export is absent', async () => {
        const book = await makeParser('## A\n- [[N1]]', {}, { N1: 'N1.md' }).parse(
            makeFile('Book.md')
        )
        expect(book.overrides).toEqual({})
    })
})
