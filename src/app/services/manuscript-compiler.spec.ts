import { afterAll, describe, expect, it } from 'bun:test'
import * as os from 'node:os'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { BookMetadata, ParsedBook } from '../domain/book-manifest.intf'
import {
    buildMetadataYaml,
    copyCitationAssets,
    CITEPROC_TYPST_FILTER,
    buildTypstCoverHeader,
    buildLatexCoverHeader,
    buildTypstPreamble,
    copyCoverAsset
} from './manuscript-compiler'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'

function makeBook(metadata: Partial<BookMetadata> = {}): ParsedBook {
    return {
        bookNotePath: 'Book.md',
        metadata: { title: 'Book', authors: ['Ada'], language: 'en', ...metadata },
        overrides: {},
        sections: [],
        maxHeadingLevel: 0
    }
}

const tempDirs: string[] = []
async function makeTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'book-exporter-spec-'))
    tempDirs.push(dir)
    return dir
}

afterAll(async () => {
    await Promise.all(tempDirs.map((d) => fs.rm(d, { recursive: true, force: true })))
})

describe('copyCitationAssets', () => {
    it('copies the bibliography into the temp dir and returns a relative path', async () => {
        const src = await makeTempDir()
        const tempDir = await makeTempDir()
        const bib = path.join(src, 'references.bib')
        await fs.writeFile(bib, '@book{a, title={A}}', 'utf8')

        const result = await copyCitationAssets(makeBook({ bibliographyPath: bib }), tempDir)

        // The returned path must be relative so Typst (project-root sandbox)
        // and citeproc (cwd == tempDir) both resolve it — see issue #2.
        expect(result.bibliography).toBe('references.bib')
        expect(path.isAbsolute(result.bibliography!)).toBe(false)
        expect(await fs.readFile(path.join(tempDir, 'references.bib'), 'utf8')).toContain('@book')
    })

    it('copies the CSL stylesheet alongside the bibliography', async () => {
        const src = await makeTempDir()
        const tempDir = await makeTempDir()
        const bib = path.join(src, 'refs.bib')
        const csl = path.join(src, 'apa.csl')
        await fs.writeFile(bib, '@book{a}', 'utf8')
        await fs.writeFile(csl, '<style/>', 'utf8')

        const result = await copyCitationAssets(
            makeBook({ bibliographyPath: bib, cslPath: csl }),
            tempDir
        )

        expect(result.bibliography).toBe('refs.bib')
        expect(result.csl).toBe('apa.csl')
        expect(await fs.readFile(path.join(tempDir, 'apa.csl'), 'utf8')).toBe('<style/>')
    })

    it('returns nothing when the manifest declares no bibliography', async () => {
        const tempDir = await makeTempDir()
        const result = await copyCitationAssets(makeBook(), tempDir)
        expect(result.bibliography).toBeUndefined()
        expect(result.csl).toBeUndefined()
    })

    it('falls back to the absolute path when the source file is missing', async () => {
        const tempDir = await makeTempDir()
        const missing = path.join(tempDir, 'does-not-exist.bib')
        const result = await copyCitationAssets(makeBook({ bibliographyPath: missing }), tempDir)
        expect(result.bibliography).toBe(missing)
    })
})

describe('buildTypstPreamble line spacing (issue #40)', () => {
    it('emits #set par(leading) as a multiple of the 0.65em default', () => {
        const preamble = buildTypstPreamble({ ...DEFAULT_SETTINGS, lineSpacing: '1.5' }, {})
        expect(preamble).toContain('#set par(leading: 1.5 * 0.65em)')
    })

    it('lets a per-book override beat the plugin setting', () => {
        const preamble = buildTypstPreamble(
            { ...DEFAULT_SETTINGS, lineSpacing: '1.5' },
            { lineSpacing: '2' }
        )
        expect(preamble).toContain('#set par(leading: 2 * 0.65em)')
        expect(preamble).not.toContain('1.5')
    })

    it('omits the leading rule when line spacing is unset or non-numeric', () => {
        expect(buildTypstPreamble(DEFAULT_SETTINGS, {})).not.toContain('leading')
        expect(
            buildTypstPreamble({ ...DEFAULT_SETTINGS, lineSpacing: 'wide' }, {})
        ).not.toContain('leading')
    })
})

describe('buildMetadataYaml', () => {
    it('prefers the relative citation paths over the absolute metadata paths', () => {
        const book = makeBook({
            bibliographyPath: '/abs/vault/references.bib',
            cslPath: '/abs/vault/apa.csl'
        })
        const yaml = buildMetadataYaml(book, { bibliography: 'references.bib', csl: 'apa.csl' })
        expect(yaml).toContain('bibliography: references.bib')
        expect(yaml).toContain('csl: apa.csl')
        expect(yaml).not.toContain('/abs/vault/')
    })

    it('falls back to the absolute metadata paths when no overrides are given', () => {
        const book = makeBook({ bibliographyPath: '/abs/vault/references.bib' })
        const yaml = buildMetadataYaml(book)
        expect(yaml).toContain('bibliography: /abs/vault/references.bib')
    })

    it('omits citation fields when the manifest has none', () => {
        const yaml = buildMetadataYaml(makeBook())
        expect(yaml).not.toContain('bibliography:')
        expect(yaml).not.toContain('csl:')
    })
})

describe('CITEPROC_TYPST_FILTER', () => {
    // Guards the load-bearing behaviour for issue #2: under the Typst PDF
    // engine, citeproc must be the only thing that renders citations, so the
    // writer never emits a native #bibliography() that fails on non-.bib files.
    it('unwraps Cite elements to their citeproc-rendered inlines', () => {
        expect(CITEPROC_TYPST_FILTER).toContain('function Cite(el)')
        expect(CITEPROC_TYPST_FILTER).toContain('return el.content')
    })

    it('strips the bibliography and csl metadata so no native directive is emitted', () => {
        expect(CITEPROC_TYPST_FILTER).toContain('function Meta(meta)')
        expect(CITEPROC_TYPST_FILTER).toContain('meta.bibliography = nil')
        expect(CITEPROC_TYPST_FILTER).toContain('meta.csl = nil')
    })
})

describe('buildTypstCoverHeader (issue #29)', () => {
    it('emits a zero-margin full-bleed image page', () => {
        const out = buildTypstCoverHeader('cover.png')
        expect(out).toContain('#page(margin: 0pt)[')
        expect(out).toContain('#image("cover.png", width: 100%, height: 100%, fit: "cover")')
    })

    it('escapes quotes and backslashes in the path', () => {
        const out = buildTypstCoverHeader('a"b\\c.png')
        expect(out).toContain('#image("a\\"b\\\\c.png"')
    })
})

describe('buildLatexCoverHeader (issue #29)', () => {
    it('emits an AtBeginDocument full-bleed eso-pic cover', () => {
        const out = buildLatexCoverHeader('cover.png')
        expect(out).toContain('\\usepackage{eso-pic}')
        expect(out).toContain('\\AtBeginDocument{')
        expect(out).toContain(
            '\\includegraphics[width=\\paperwidth,height=\\paperheight]{cover.png}'
        )
        expect(out).toContain('\\clearpage')
    })
})

describe('copyCoverAsset (issue #29)', () => {
    it('copies a local cover into the temp dir and returns its relative name', async () => {
        const src = await makeTempDir()
        const tempDir = await makeTempDir()
        const cover = path.join(src, 'mybook cover.png')
        await fs.writeFile(cover, 'PNGDATA', 'utf8')

        const rel = await copyCoverAsset(cover, tempDir)

        expect(rel).toBe('mybook_cover.png') // sanitized
        expect(await fs.readFile(path.join(tempDir, 'mybook_cover.png'), 'utf8')).toBe('PNGDATA')
    })

    it('reuses a cover already inside the temp dir without copying onto itself', async () => {
        const tempDir = await makeTempDir()
        const cover = path.join(tempDir, 'cover.png')
        await fs.writeFile(cover, 'PNGDATA', 'utf8')

        const rel = await copyCoverAsset(cover, tempDir)

        expect(rel).toBe('cover.png')
        expect(await fs.readFile(path.join(tempDir, 'cover.png'), 'utf8')).toBe('PNGDATA')
    })

    it('returns undefined for a remote (http) cover', async () => {
        const tempDir = await makeTempDir()
        expect(await copyCoverAsset('https://example.com/c.png', tempDir)).toBeUndefined()
    })

    it('returns undefined when there is no cover', async () => {
        const tempDir = await makeTempDir()
        expect(await copyCoverAsset(undefined, tempDir)).toBeUndefined()
    })

    it('returns undefined when the source file is missing', async () => {
        const tempDir = await makeTempDir()
        const missing = path.join(tempDir, 'nope', 'cover.png')
        expect(await copyCoverAsset(missing, tempDir)).toBeUndefined()
    })
})
