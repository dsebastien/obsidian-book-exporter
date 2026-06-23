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
})
