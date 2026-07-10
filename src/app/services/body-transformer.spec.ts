import { afterAll, describe, expect, it } from 'bun:test'
import * as os from 'node:os'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import { TFile, type App } from 'obsidian'
import { BodyTransformer } from './manuscript-compiler'

/** Builds a TFile-like instance that passes `instanceof TFile` (mocked). */
function makeFile(p: string): TFile {
    const name = p.split('/').pop() ?? p
    const dot = name.lastIndexOf('.')
    const extension = dot >= 0 ? name.slice(dot + 1) : ''
    const basename = dot >= 0 ? name.slice(0, dot) : name
    return Object.assign(new TFile(), { path: p, name, extension, basename })
}

/**
 * Minimal App whose link resolver maps file paths to TFiles. `contents` lets
 * note bodies be supplied for embed-expansion tests (keyed by path).
 */
function makeApp(paths: string[], contents: Record<string, string> = {}): App {
    // Resolve by full path, by name, and by basename — mirroring how Obsidian's
    // getFirstLinkpathDest accepts `Child`, `Child.md`, or `a/diagram.png`.
    const byKey = new Map<string, TFile>()
    for (const p of paths) {
        const file = makeFile(p)
        byKey.set(p, file)
        byKey.set(file.name, file)
        byKey.set(file.basename, file)
    }
    return {
        metadataCache: {
            getFirstLinkpathDest: (linkpath: string): TFile | null => byKey.get(linkpath) ?? null
        },
        vault: {
            // Distinct bytes per path so an overwrite would be detectable.
            readBinary: (file: TFile): Promise<ArrayBuffer> =>
                Promise.resolve(new TextEncoder().encode(`bytes:${file.path}`).buffer),
            cachedRead: (file: TFile): Promise<string> => Promise.resolve(contents[file.path] ?? '')
        }
    } as unknown as App
}

const tempDirs: string[] = []
async function makeResourcesDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bt-spec-'))
    tempDirs.push(dir)
    return dir
}

afterAll(async () => {
    await Promise.all(tempDirs.map((d) => fs.rm(d, { recursive: true, force: true })))
})

const opts = { expandNoteEmbeds: false, noteEmbedMaxDepth: 3, sectionsToSkip: [] }

describe('BodyTransformer image handling (issue #5)', () => {
    it('gives same-basename images in different folders distinct output files', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['a/diagram.png', 'b/diagram.png'])
        const bt = new BodyTransformer(app, resources, opts)
        const source = makeFile('note.md')

        const out = await bt.transform('![[a/diagram.png]]\n![[b/diagram.png]]', source)

        expect(out).toContain('(_resources/diagram.png)')
        expect(out).toContain('(_resources/diagram-2.png)')
        const written = (await fs.readdir(resources)).sort()
        expect(written).toEqual(['diagram-2.png', 'diagram.png'])
        // Each file keeps its own bytes — no overwrite.
        expect(await fs.readFile(path.join(resources, 'diagram.png'), 'utf8')).toBe(
            'bytes:a/diagram.png'
        )
        expect(await fs.readFile(path.join(resources, 'diagram-2.png'), 'utf8')).toBe(
            'bytes:b/diagram.png'
        )
    })

    it('copies the same image once when embedded multiple times', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['a/diagram.png'])
        const bt = new BodyTransformer(app, resources, opts)
        const source = makeFile('note.md')

        const out = await bt.transform('![[a/diagram.png]]\n![[a/diagram.png]]', source)

        const links = out.match(/_resources\/diagram\.png/g) ?? []
        expect(links.length).toBe(2)
        expect(await fs.readdir(resources)).toEqual(['diagram.png'])
    })
})

describe('BodyTransformer image handling — absolute filesystem paths (issue #51)', () => {
    it('copies an image referenced by an absolute path instead of leaving the raw path in the output', async () => {
        const resources = await makeResourcesDir()
        const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'bt-abs-src-'))
        tempDirs.push(scratch)
        const absImagePath = path.join(scratch, 'landscape.png')
        await fs.writeFile(absImagePath, 'raw-bytes')

        // Not resolvable via the vault's link index — mirrors an
        // absolute-path reference left behind by another tool.
        const app = makeApp([])
        const bt = new BodyTransformer(app, resources, opts)

        const out = await bt.transform(`![alt](${absImagePath})`, makeFile('note.md'))

        // The raw OS path must never reach the manuscript: Typst treats a
        // leading `/` as root-relative to its own sandbox rather than an OS
        // absolute path, so passing it through produces an unresolvable,
        // duplicated path instead of a clean "file not found".
        expect(out).not.toContain(absImagePath)
        expect(out).toBe('![alt](_resources/landscape.png)')
        expect(await fs.readFile(path.join(resources, 'landscape.png'), 'utf8')).toBe('raw-bytes')
    })

    it('gives same-basename absolute-path images distinct output files (issue #5 parity)', async () => {
        const resources = await makeResourcesDir()
        const scratchA = await fs.mkdtemp(path.join(os.tmpdir(), 'bt-abs-a-'))
        const scratchB = await fs.mkdtemp(path.join(os.tmpdir(), 'bt-abs-b-'))
        tempDirs.push(scratchA, scratchB)
        const imgA = path.join(scratchA, 'diagram.png')
        const imgB = path.join(scratchB, 'diagram.png')
        await fs.writeFile(imgA, 'bytes-a')
        await fs.writeFile(imgB, 'bytes-b')

        const bt = new BodyTransformer(makeApp([]), resources, opts)
        const out = await bt.transform(`![[${imgA}]]\n![[${imgB}]]`, makeFile('note.md'))

        expect(out).toContain('(_resources/diagram.png)')
        expect(out).toContain('(_resources/diagram-2.png)')
        expect(await fs.readFile(path.join(resources, 'diagram.png'), 'utf8')).toBe('bytes-a')
        expect(await fs.readFile(path.join(resources, 'diagram-2.png'), 'utf8')).toBe('bytes-b')
    })

    it('leaves the reference unresolved when the absolute path does not exist on disk', async () => {
        const resources = await makeResourcesDir()
        const bt = new BodyTransformer(makeApp([]), resources, opts)
        const missing = path.join(os.tmpdir(), 'bt-abs-missing-1234', 'x.png')

        const out = await bt.transform(`![alt](${missing})`, makeFile('note.md'))

        expect(out).toBe(`![alt](${missing})`)
    })
})

describe('BodyTransformer markup rewriting', () => {
    it('converts a callout to a fenced div', async () => {
        const resources = await makeResourcesDir()
        const bt = new BodyTransformer(makeApp([]), resources, opts)
        const input = ['> [!note] Heads up', '> body line', '', 'after'].join('\n')

        const out = await bt.transform(input, makeFile('n.md'))

        expect(out).toContain('::: {.callout .callout-note}')
        expect(out).toContain('**Heads up**')
        expect(out).toContain('body line')
        expect(out).toContain(':::')
        expect(out).toContain('after')
    })

    it('flattens [[wikilinks]] to display text (alias wins)', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['Concept.md'])
        const bt = new BodyTransformer(app, resources, opts)

        const out = await bt.transform(
            'See [[Concept]] and [[Concept|the idea]].',
            makeFile('n.md')
        )

        expect(out).toBe('See Concept and the idea.')
    })

    it('turns a remote image embed into a plain link instead of a broken image', async () => {
        const resources = await makeResourcesDir()
        const bt = new BodyTransformer(makeApp([]), resources, opts)

        const out = await bt.transform('![alt](https://example.com/x.png)', makeFile('n.md'))

        expect(out).toBe('[alt](https://example.com/x.png)')
    })

    it('labels a video embed link by platform (www.youtube.com)', async () => {
        const resources = await makeResourcesDir()
        const bt = new BodyTransformer(makeApp([]), resources, opts)

        const out = await bt.transform('![[https://www.youtube.com/watch?v=abc]]', makeFile('n.md'))

        expect(out).toBe('[Watch on YouTube](https://www.youtube.com/watch?v=abc)')
    })

    it('labels scheme-prefixed video hosts without a subdomain (issue #23)', async () => {
        const resources = await makeResourcesDir()
        const bt = new BodyTransformer(makeApp([]), resources, opts)
        const cases: [string, string][] = [
            ['https://youtu.be/abc', 'Watch on YouTube'],
            ['https://youtube.com/watch?v=abc', 'Watch on YouTube'],
            ['https://vimeo.com/123', 'Watch on Vimeo'],
            ['https://www.loom.com/share/xyz', 'Watch on Loom']
        ]
        for (const [url, label] of cases) {
            const out = await bt.transform(`![[${url}]]`, makeFile('n.md'))
            expect(out).toBe(`[${label}](${url})`)
        }
    })

    it('leaves a non-video remote embed as a plain url link', async () => {
        const resources = await makeResourcesDir()
        const bt = new BodyTransformer(makeApp([]), resources, opts)

        const out = await bt.transform('![[https://example.com/page]]', makeFile('n.md'))

        expect(out).toBe('[https://example.com/page](https://example.com/page)')
    })
})

describe('BodyTransformer note-embed expansion', () => {
    const embedOpts = { expandNoteEmbeds: true, noteEmbedMaxDepth: 3, sectionsToSkip: [] }

    it('inlines an embedded note body when enabled', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['Child.md'], { 'Child.md': '# Child\nchild prose' })
        const bt = new BodyTransformer(app, resources, embedOpts)

        const out = await bt.transform('![[Child]]', makeFile('parent.md'))

        // First H1 of the embed is dropped; body is inlined.
        expect(out).toContain('child prose')
        expect(out).not.toContain('# Child')
    })

    it('does not expand embeds when the feature is disabled', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['Child.md'], { 'Child.md': 'child prose' })
        const bt = new BodyTransformer(app, resources, opts) // expandNoteEmbeds: false

        const out = await bt.transform('![[Child]]', makeFile('parent.md'))

        expect(out).not.toContain('child prose')
    })

    it('breaks embed cycles instead of recursing forever', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['A.md', 'B.md'], {
            'A.md': 'A body ![[B]]',
            'B.md': 'B body ![[A]]'
        })
        const bt = new BodyTransformer(app, resources, embedOpts)

        const out = await bt.transform('![[A]]', makeFile('root.md'))

        expect(out).toContain('A body')
        expect(out).toContain('B body')
        // Resolves without throwing / hanging — cycle is cut.
    })

    it('inlines only the referenced block, not the whole note (issue #50)', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['Lit.md'], {
            'Lit.md': [
                '# Literature note',
                'lots of unrelated prose',
                '',
                'the quoted sentence ^2345fr',
                '',
                'more unrelated prose'
            ].join('\n')
        })
        const bt = new BodyTransformer(app, resources, embedOpts)

        const out = await bt.transform('![[Lit^2345fr]]', makeFile('chapter.md'))

        expect(out).toContain('the quoted sentence')
        expect(out).not.toContain('unrelated prose')
        expect(out).not.toContain('^2345fr')
    })

    it('inlines only the referenced heading section (issue #50)', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['Note.md'], {
            'Note.md': [
                '# Note',
                'intro',
                '## Wanted',
                'wanted body',
                '## Other',
                'other body'
            ].join('\n')
        })
        const bt = new BodyTransformer(app, resources, embedOpts)

        const out = await bt.transform('![[Note#Wanted]]', makeFile('chapter.md'))

        expect(out).toContain('wanted body')
        expect(out).not.toContain('other body')
        expect(out).not.toContain('intro')
    })

    it('shows the reference text when an anchor cannot be resolved', async () => {
        const resources = await makeResourcesDir()
        const app = makeApp(['Note.md'], { 'Note.md': '# Note\nbody prose' })
        const bt = new BodyTransformer(app, resources, embedOpts)

        const out = await bt.transform('![[Note#^missing]]', makeFile('chapter.md'))

        // Falls back to a reference rather than dumping the whole note.
        expect(out).not.toContain('body prose')
        expect(out).toContain('Note')
    })
})
