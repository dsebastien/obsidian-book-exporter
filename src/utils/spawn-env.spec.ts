import { describe, expect, it } from 'bun:test'
import * as path from 'node:path'
import { buildSpawnEnv } from './spawn-env'

const sep = path.delimiter
const noAuto = (): boolean => false

function withPath<T>(value: string | undefined, fn: () => T): T {
    const original = process.env['PATH']
    if (value === undefined) delete process.env['PATH']
    else process.env['PATH'] = value
    try {
        return fn()
    } finally {
        if (original === undefined) delete process.env['PATH']
        else process.env['PATH'] = original
    }
}

describe('buildSpawnEnv (no auto-detection)', () => {
    it('returns process.env unchanged when extraPath is empty', () => {
        expect(buildSpawnEnv('', noAuto)).toBe(process.env)
        expect(buildSpawnEnv('   ', noAuto)).toBe(process.env)
    })

    it('returns process.env unchanged when extraPath only contains separators / whitespace', () => {
        expect(buildSpawnEnv(`${sep}${sep}  `, noAuto)).toBe(process.env)
    })

    it('prepends extra directories to PATH using the OS separator', () => {
        withPath(`/usr/bin${sep}/bin`, () => {
            const env = buildSpawnEnv(`/opt/homebrew/bin${sep}/Library/TeX/texbin`, noAuto)
            expect(env['PATH']).toBe(
                `/opt/homebrew/bin${sep}/Library/TeX/texbin${sep}/usr/bin${sep}/bin`
            )
        })
    })

    it('handles a missing PATH on the parent env', () => {
        withPath(undefined, () => {
            expect(buildSpawnEnv('/opt/homebrew/bin', noAuto)['PATH']).toBe('/opt/homebrew/bin')
        })
    })

    it('does not mutate process.env', () => {
        const before = process.env['PATH']
        buildSpawnEnv('/opt/homebrew/bin', noAuto)
        expect(process.env['PATH']).toBe(before)
    })

    it('trims whitespace around individual entries', () => {
        withPath('/usr/bin', () => {
            const env = buildSpawnEnv(`  /opt/homebrew/bin  ${sep}  /Library/TeX/texbin  `, noAuto)
            expect(env['PATH']).toBe(`/opt/homebrew/bin${sep}/Library/TeX/texbin${sep}/usr/bin`)
        })
    })
})

describe('buildSpawnEnv auto-detection (issue #9)', () => {
    const onlyHomebrew = (dir: string): boolean => dir === '/opt/homebrew/bin'

    it('appends a well-known dir that exists but is not already on PATH', () => {
        withPath('/usr/bin', () => {
            const env = buildSpawnEnv('', onlyHomebrew)
            expect(env['PATH']).toBe(`/usr/bin${sep}/opt/homebrew/bin`)
        })
    })

    it('skips well-known dirs that do not exist', () => {
        withPath('/usr/bin', () => {
            // /Library/TeX/texbin would be a candidate but the predicate denies it
            const env = buildSpawnEnv('', onlyHomebrew)
            expect(env['PATH']).not.toContain('/Library/TeX/texbin')
        })
    })

    it('does not duplicate a well-known dir already on PATH', () => {
        withPath(`/usr/bin${sep}/opt/homebrew/bin`, () => {
            const env = buildSpawnEnv('', onlyHomebrew)
            // No change → same env object, no duplicate entry.
            expect(env).toBe(process.env)
        })
    })

    it('keeps user extraPath ahead of both PATH and auto-detected dirs', () => {
        withPath('/usr/bin', () => {
            const env = buildSpawnEnv('/my/tools', onlyHomebrew)
            expect(env['PATH']).toBe(`/my/tools${sep}/usr/bin${sep}/opt/homebrew/bin`)
        })
    })
})
