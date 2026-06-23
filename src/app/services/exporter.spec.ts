import { describe, expect, it } from 'bun:test'
import * as os from 'node:os'
import * as path from 'node:path'
import { expandHome } from './exporter'

describe('expandHome', () => {
    it('expands a bare ~ to the home directory', () => {
        expect(expandHome('~')).toBe(os.homedir())
    })

    it('expands a leading ~/ to a path under the home directory', () => {
        expect(expandHome('~/Books')).toBe(path.join(os.homedir(), 'Books'))
    })

    it('returns an absolute path unchanged', () => {
        expect(expandHome('/srv/exports')).toBe('/srv/exports')
    })

    it('does not resolve another user — ~otheruser is left verbatim', () => {
        // Documented behaviour: only the current user's home is expanded;
        // resolveOutputDir rejects the (still non-absolute) result clearly.
        expect(expandHome('~someoneelse/Books')).toBe('~someoneelse/Books')
    })

    it('leaves a tilde in the middle of a path untouched', () => {
        expect(expandHome('/tmp/a~b')).toBe('/tmp/a~b')
    })
})
