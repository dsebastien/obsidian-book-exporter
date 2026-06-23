import { describe, expect, it } from 'bun:test'
import { TFile, type App } from 'obsidian'
import { BookValidator } from './validator'
import type { BookMetadata, BookSection, ParsedBook } from '../domain/book-manifest.intf'

/** App whose vault resolves only the given paths to (mock) TFiles. */
function makeApp(existingNotePaths: string[]): App {
    const set = new Set(existingNotePaths)
    return {
        vault: {
            getAbstractFileByPath: (p: string) =>
                set.has(p) ? Object.assign(new TFile(), { path: p }) : null
        }
    } as unknown as App
}

function section(title: string, notePaths: string[]): BookSection {
    return {
        level: 2,
        title,
        prose: '',
        notes: notePaths.map((p) => ({ filePath: p, displayTitle: p })),
        children: []
    }
}

function makeBook(
    metadata: Partial<BookMetadata> = {},
    sections: BookSection[] = [section('Chapter 1', ['ch1.md'])]
): ParsedBook {
    return {
        bookNotePath: 'Book.md',
        metadata: { title: 'Book', authors: ['Ada'], language: 'en', ...metadata },
        overrides: {},
        sections,
        maxHeadingLevel: 2
    }
}

const present = () => true
const absent = () => false

describe('BookValidator citation files (issue #10)', () => {
    it('warns when the bibliography file is missing', () => {
        const v = new BookValidator(makeApp(['ch1.md']), absent)
        const report = v.validate(makeBook({ bibliographyPath: '/v/refs.json' }))
        const warnings = report.issues.filter((i) => i.level === 'warning')
        expect(warnings.some((w) => w.message.includes('Bibliography file not found'))).toBe(true)
        expect(report.hasErrors).toBe(false)
    })

    it('does not warn when the bibliography file exists', () => {
        const v = new BookValidator(makeApp(['ch1.md']), present)
        const report = v.validate(makeBook({ bibliographyPath: '/v/refs.json' }))
        expect(report.issues.some((i) => i.message.includes('Bibliography'))).toBe(false)
    })

    it('warns when the CSL stylesheet is missing', () => {
        const v = new BookValidator(makeApp(['ch1.md']), absent)
        const report = v.validate(makeBook({ cslPath: '/v/apa.csl' }))
        expect(report.issues.some((i) => i.message.includes('CSL stylesheet not found'))).toBe(true)
    })

    it('raises no citation issue when none is configured', () => {
        const v = new BookValidator(makeApp(['ch1.md']), absent)
        const report = v.validate(makeBook())
        expect(report.issues.some((i) => /bibliography|csl/i.test(i.message))).toBe(false)
    })
})

describe('BookValidator core checks', () => {
    it('errors on missing title and missing sections', () => {
        const v = new BookValidator(makeApp([]), present)
        const report = v.validate(makeBook({ title: '   ' }, []))
        expect(report.hasErrors).toBe(true)
        expect(report.issues.some((i) => i.message.includes('Missing book title'))).toBe(true)
        expect(report.issues.some((i) => i.message.includes('No sections found'))).toBe(true)
    })

    it('errors on an unresolved note link', () => {
        const v = new BookValidator(makeApp([]), present) // ch1.md does not resolve
        const report = v.validate(makeBook())
        expect(report.hasErrors).toBe(true)
        expect(report.issues.some((i) => i.message.includes('Unresolved link'))).toBe(true)
    })

    it('warns on a duplicate note reference', () => {
        const v = new BookValidator(makeApp(['ch1.md']), present)
        const book = makeBook({}, [section('A', ['ch1.md']), section('B', ['ch1.md'])])
        const report = v.validate(book)
        expect(report.issues.some((i) => i.message.includes('Duplicate note'))).toBe(true)
    })
})
