import { describe, expect, it } from 'bun:test'
import type {
    BookExportOverrides,
    ParsedBook,
    BookMetadata,
    PdfEngine
} from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'
import {
    PandocRunner,
    pickPdfEngineArg,
    pushPageSetupArgs,
    normaliseFontSize,
    typstPaper,
    latexPaper,
    classifyPandocError
} from './pandoc-runner'
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

    it('omits --citeproc without a bibliography but still runs the Typst filter (#2)', () => {
        // A stray @token with no bibliography must not become a native #cite();
        // the filter neutralises it even though citeproc is off.
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'typst' }))
        const args = buildArgs(runner, 'pdf', makeBook(), compiled, '/out/book.pdf')

        expect(args).not.toContain('--citeproc')
        expect(args).toContain('--lua-filter=/tmp/book/citeproc-typst.lua')
    })

    it('does not run the Typst filter for non-Typst engines', () => {
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'xelatex' }))
        const args = buildArgs(runner, 'pdf', makeBook(), compiled, '/out/book.pdf')
        expect(args.some((a) => a.startsWith('--lua-filter'))).toBe(false)
    })

    it('honours a per-book Typst override even when the default engine is LaTeX', () => {
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'xelatex' }))
        const book = makeBook({ pdfEngine: 'typst' }, { bibliographyPath: '/v/refs.json' })
        const args = buildArgs(runner, 'pdf', book, compiled, '/out/book.pdf')

        expect(args).toContain('--lua-filter=/tmp/book/citeproc-typst.lua')
    })
})

describe('buildArgs cover handling (issue #29)', () => {
    const withCover = makeCompiled({
        coverHeaderTypstPath: '/tmp/book/cover-header.typ',
        coverHeaderLatexPath: '/tmp/book/cover-header.tex'
    })

    it('includes the Typst cover header for a Typst PDF with a cover', () => {
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'typst' }))
        const args = buildArgs(runner, 'pdf', makeBook(), withCover, '/out/book.pdf')
        expect(args).toContain('--include-in-header=/tmp/book/cover-header.typ')
    })

    it('includes the LaTeX cover header for xelatex and tectonic', () => {
        for (const engine of ['xelatex', 'tectonic'] as const) {
            const runner = new PandocRunner(makeSettings({ defaultPdfEngine: engine }))
            const args = buildArgs(runner, 'pdf', makeBook(), withCover, '/out/book.pdf')
            expect(args).toContain('--include-in-header=/tmp/book/cover-header.tex')
            expect(args).not.toContain('--include-in-header=/tmp/book/cover-header.typ')
        }
    })

    it('does not include a cover header for EPUB or when no cover is compiled', () => {
        const runner = new PandocRunner(makeSettings({ defaultPdfEngine: 'typst' }))
        const epub = buildArgs(runner, 'epub', makeBook(), withCover, '/out/book.epub')
        expect(epub.some((a) => a.startsWith('--include-in-header'))).toBe(false)
        const noCover = buildArgs(runner, 'pdf', makeBook(), makeCompiled(), '/out/book.pdf')
        expect(noCover.some((a) => a.startsWith('--include-in-header'))).toBe(false)
    })
})

/** Collects every value that follows a `-V` flag in an argv array. */
function variableValues(args: string[]): string[] {
    const out: string[] = []
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-V' && args[i + 1] !== undefined) out.push(args[i + 1]!)
    }
    return out
}

/** Collects every value that follows a `-M` flag in an argv array. */
function metadataValues(args: string[]): string[] {
    const out: string[] = []
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-M' && args[i + 1] !== undefined) out.push(args[i + 1]!)
    }
    return out
}

function pageSetup(
    engine: PdfEngine,
    settings: Partial<PluginSettings>,
    overrides: BookExportOverrides = {}
): string[] {
    const args: string[] = []
    pushPageSetupArgs(args, engine, makeBook(overrides), makeSettings(settings))
    return args
}

describe('page-size helpers (issue #40)', () => {
    it('maps US names to Typst hyphenated paper names', () => {
        expect(typstPaper('us-letter')).toBe('us-letter')
        expect(typstPaper('letter')).toBe('us-letter')
        expect(typstPaper('legal')).toBe('us-legal')
        expect(typstPaper('A4')).toBe('a4')
    })

    it('maps US names to LaTeX paper keywords', () => {
        expect(latexPaper('us-letter')).toBe('letter')
        expect(latexPaper('letter')).toBe('letter')
        expect(latexPaper('us-legal')).toBe('legal')
        expect(latexPaper('a4')).toBe('a4')
    })

    it('appends pt to a bare numeric font size and leaves units alone', () => {
        expect(normaliseFontSize('12')).toBe('12pt')
        expect(normaliseFontSize('11.5')).toBe('11.5pt')
        expect(normaliseFontSize('11pt')).toBe('11pt')
        expect(normaliseFontSize('')).toBe('')
    })
})

describe('pushPageSetupArgs (issue #40)', () => {
    it('translates page setup for Typst (-V papersize/fontsize, -M margin map)', () => {
        const args = pageSetup('typst', {
            pageSize: 'us-letter',
            pageMargin: '2cm',
            baseFontSize: '12'
        })
        expect(variableValues(args)).toContain('papersize=us-letter')
        expect(variableValues(args)).toContain('fontsize=12pt')
        expect(metadataValues(args)).toEqual(['margin.x=2cm', 'margin.y=2cm'])
        // Typst line spacing is handled in the preamble, never as a pandoc arg.
        expect(variableValues(args).some((v) => v.startsWith('linestretch'))).toBe(false)
    })

    it('translates page setup for LaTeX (geometry + setspace + papersize + fontsize)', () => {
        const args = pageSetup('xelatex', {
            pageSize: 'us-letter',
            pageMargin: '1in',
            lineSpacing: '1.5',
            baseFontSize: '12pt'
        })
        expect(variableValues(args)).toContain('papersize=letter')
        expect(variableValues(args)).toContain('geometry:margin=1in')
        expect(variableValues(args)).toContain('linestretch=1.5')
        expect(variableValues(args)).toContain('fontsize=12pt')
        // LaTeX margins go through geometry, never the Typst metadata map.
        expect(metadataValues(args)).toHaveLength(0)
    })

    it('emits nothing when no page setup is configured', () => {
        expect(pageSetup('typst', {})).toEqual([])
        expect(pageSetup('xelatex', {})).toEqual([])
    })

    it('lets a per-book override beat the plugin setting', () => {
        const args = pageSetup('typst', { pageSize: 'a4' }, { pageSize: 'a5' })
        expect(variableValues(args)).toContain('papersize=a5')
        expect(variableValues(args)).not.toContain('papersize=a4')
    })

    it('suppresses defaults the user already pinned via pandoc_extra_args', () => {
        const typst = pageSetup(
            'typst',
            { pageSize: 'a4', baseFontSize: '12pt', pageMargin: '2cm' },
            { pandocExtraArgs: ['-V', 'papersize=a5', '-V', 'fontsize=14pt', '-M', 'margin.x=3cm'] }
        )
        expect(variableValues(typst).some((v) => v.startsWith('papersize'))).toBe(false)
        expect(variableValues(typst).some((v) => v.startsWith('fontsize'))).toBe(false)
        expect(metadataValues(typst)).toHaveLength(0)

        const latex = pageSetup(
            'tectonic',
            { pageMargin: '2cm', lineSpacing: '1.5' },
            { pandocExtraArgs: ['-V', 'geometry:margin=3cm', '-V', 'linestretch=2'] }
        )
        expect(variableValues(latex).some((v) => v.startsWith('geometry'))).toBe(false)
        expect(variableValues(latex).some((v) => v.startsWith('linestretch'))).toBe(false)
    })

    it('is wired into buildArgs for PDF and skipped for EPUB', () => {
        const runner = new PandocRunner(
            makeSettings({ defaultPdfEngine: 'typst', pageSize: 'a4', pageMargin: '2cm' })
        )
        const pdf = buildArgs(runner, 'pdf', makeBook(), makeCompiled(), '/out/book.pdf')
        expect(variableValues(pdf)).toContain('papersize=a4')
        expect(metadataValues(pdf)).toContain('margin.x=2cm')

        const epub = buildArgs(runner, 'epub', makeBook(), makeCompiled(), '/out/book.epub')
        expect(variableValues(epub).some((v) => v.startsWith('papersize'))).toBe(false)
        expect(epub.includes('-M')).toBe(false)
    })
})

describe('classifyPandocError (issue #35)', () => {
    it('flags a stray @citation with no bibliography', () => {
        const hint = classifyPandocError(
            'error: cited key was not found but document does not contain a bibliography'
        )
        expect(hint).toContain('bibliography:')
        expect(hint).toContain('@token')
    })

    it('flags an unknown bibliography format', () => {
        const hint = classifyPandocError('error: unknown bibliography format "csl-yaml"')
        expect(hint).toContain('.bib')
        expect(hint).toContain('citeproc')
    })

    it('flags an empty font fallback list', () => {
        const hint = classifyPandocError(
            'error: variable used in template `conf`: font fallback list must not be empty'
        )
        expect(hint).toContain('PDF main font')
        expect(hint).toContain('typst fonts')
    })

    it('flags an unknown / missing font family', () => {
        expect(classifyPandocError('error: unknown font family: "Noto Nope"')).toContain(
            'typst fonts'
        )
    })

    it('flags a missing PDF engine', () => {
        const hint = classifyPandocError(
            'pdflatex not found. Please select a different --pdf-engine or install pdflatex'
        )
        expect(hint).toContain('PDF engine')
    })

    it('flags a missing resource / image', () => {
        const hint = classifyPandocError('error: file not found (searched at images/cover.png)')
        expect(hint).toContain('image')
        expect(hint).toContain('local copy')
    })

    it('matches case-insensitively', () => {
        expect(
            classifyPandocError('FONT FALLBACK LIST MUST NOT BE EMPTY')
        ).toContain('PDF main font')
    })

    it('returns null for an unrecognised error (falls back to the raw tail)', () => {
        expect(classifyPandocError('error: something entirely novel happened on line 7')).toBe(
            null
        )
        expect(classifyPandocError('')).toBe(null)
    })
})
