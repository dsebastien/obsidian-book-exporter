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

/** Minimal App whose link resolver maps a set of file paths to TFiles. */
function makeApp(paths: string[]): App {
    const byPath = new Map(paths.map((p) => [p, makeFile(p)]))
    return {
        metadataCache: {
            getFirstLinkpathDest: (linkpath: string): TFile | null => byPath.get(linkpath) ?? null
        },
        vault: {
            // Distinct bytes per path so an overwrite would be detectable.
            readBinary: (file: TFile): Promise<ArrayBuffer> =>
                Promise.resolve(new TextEncoder().encode(`bytes:${file.path}`).buffer)
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
