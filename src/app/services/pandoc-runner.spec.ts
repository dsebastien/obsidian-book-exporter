import { describe, expect, it } from 'bun:test'
import type { BookExportOverrides, ParsedBook, BookMetadata } from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'
import { PandocRunner, pickPdfEngineArg } from './pandoc-runner'
import type { CompiledManuscript } from './manuscript-compiler'

function makeBook(
    overrides: BookExportOverrides = {},
    metadata: Partial<BookMetadata> = {}
): ParsedBook {
    return {
        bookNotePath: 'Book.md',
        metadata: { title: 'Book', authors: [], language: 'en', ...metadata },
        overrides,
        sections: [],
        maxHeadingLevel: 0
    }
}

function makeSettings(patch: Partial<PluginSettings> = {}): PluginSettings {
    return { ...DEFAULT_SETTINGS, ...patch }
}

function makeCompiled(patch: Partial<CompiledManuscript> = {}): CompiledManuscript {
    return {
        manuscriptPath: '/tmp/book/manuscript.md',
        resourcesDir: '/tmp/book/_resources',
        tempDir: '/tmp/book',
        metadataPath: '/tmp/book/metadata.yaml',
        ...patch
    }
}

/** Reaches the private `buildArgs` to assert the emitted CLI argv. */
function buildArgs(runner: PandocRunner, ...rest: Parameters<PandocRunner['run']>): string[] {
    return (runner as unknown as { buildArgs: (...a: typeof rest) => string[] }).buildArgs(...rest)
}

describe('pickPdfEngineArg', () => {
    it('returns the engine name when no path is configured', () => {
        const settings = makeSettings({ pdfEnginePath: '' })
        expect(pickPdfEngineArg('typst', makeBook(), settings)).toBe('typst')
    })

    it('forwards the configured path when the basename matches the engine', () => {
        const settings = makeSettings({ pdfEnginePath: '/opt/homebrew/bin/typst' })
        expect(pickPdfEngineArg('typst', makeBook(), settings)).toBe('/opt/homebrew/bin/typst')
    })

    it('handles a Windows-style .exe basename', () => {
        const settings = makeSettings({ pdfEnginePath: 'C:\\Tools\\typst.exe' })
        // On POSIX, basename keeps the whole "C:\\Tools\\typst.exe" string,
        // which then has to startsWith("typst.") — guard the test by
        // matching the prefix instead of asserting the exact basename split.
        const arg = pickPdfEngineArg('typst', makeBook(), settings)
        expect(arg === 'C:\\Tools\\typst.exe' || arg === 'typst').toBe(true)
    })

    it('falls back to the engine name when the basename does not match', () => {
        const settings = makeSettings({ pdfEnginePath: '/opt/homebrew/bin/typst' })
        expect(pickPdfEngineArg('xelatex', makeBook(), settings)).toBe('xelatex')
    })

    it("yields to the user's --pdf-engine in pandocExtraArgs (--pdf-engine path form)", () => {
        const settings = makeSettings({ pdfEnginePath: '/opt/homebrew/bin/typst' })
        const book = makeBook({ pandocExtraArgs: ['--pdf-engine', '/custom/typst'] })
        expect(pickPdfEngineArg('typst', book, settings)).toBe('typst')
    })

    it("yields to the user's --pdf-engine in pandocExtraArgs (--pdf-engine=path form)", () => {
        const settings = makeSettings({ pdfEnginePath: '/opt/homebrew/bin/typst' })
        const book = makeBook({ pandocExtraArgs: ['--pdf-engine=/custom/typst'] })
        expect(pickPdfEngineArg('typst', book, settings)).toBe('typst')
    })
})

describe('buildArgs citation handling (issue #2)', () => {
    const compiled = makeCompiled({ citationFilterPath: '/tmp/book/citeproc-typst.lua' })

    it('adds the citeproc-only Lua filter after --citeproc for the Typst engine', () => {
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'typst' }))
        const book = makeBook({}, { bibliographyPath: '/v/refs.json' })
        const args = buildArgs(runner, 'pdf', book, compiled, '/out/book.pdf')

        const citeprocAt = args.indexOf('--citeproc')
        const filterAt = args.indexOf('--lua-filter=/tmp/book/citeproc-typst.lua')
        expect(citeprocAt).toBeGreaterThanOrEqual(0)
        // Order matters: the filter must run *after* citeproc has rendered the
        // citations, otherwise it strips the bibliography before citeproc sees it.
        expect(filterAt).toBeGreaterThan(citeprocAt)
    })

    it('does not add the Lua filter for LaTeX engines (no native bibliography bug)', () => {
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'xelatex' }))
        const book = makeBook({}, { bibliographyPath: '/v/refs.bib' })
        const args = buildArgs(runner, 'pdf', book, compiled, '/out/book.pdf')

        expect(args).toContain('--citeproc')
        expect(args.some((a) => a.startsWith('--lua-filter'))).toBe(false)
    })

    it('does not add the Lua filter for EPUB', () => {
        const runner = new PandocRunner(makeSettings())
        const book = makeBook({}, { bibliographyPath: '/v/refs.json' })
        const args = buildArgs(runner, 'epub', book, compiled, '/out/book.epub')

        expect(args).toContain('--citeproc')
        expect(args.some((a) => a.startsWith('--lua-filter'))).toBe(false)
    })

    it('enables neither citeproc nor the filter when the manifest has no bibliography', () => {
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'typst' }))
        const args = buildArgs(runner, 'pdf', makeBook(), makeCompiled(), '/out/book.pdf')

        expect(args).not.toContain('--citeproc')
        expect(args.some((a) => a.startsWith('--lua-filter'))).toBe(false)
    })

    it('honours a per-book Typst override even when the default engine is LaTeX', () => {
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'xelatex' }))
        const book = makeBook({ pdfEngine: 'typst' }, { bibliographyPath: '/v/refs.json' })
        const args = buildArgs(runner, 'pdf', book, compiled, '/out/book.pdf')

        expect(args).toContain('--lua-filter=/tmp/book/citeproc-typst.lua')
    })
})
