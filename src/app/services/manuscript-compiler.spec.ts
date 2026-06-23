import { afterAll, describe, expect, it } from 'bun:test'
import * as os from 'node:os'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { BookMetadata, ParsedBook } from '../domain/book-manifest.intf'
import { buildMetadataYaml, copyCitationAssets, CITEPROC_TYPST_FILTER } from './manuscript-compiler'

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
