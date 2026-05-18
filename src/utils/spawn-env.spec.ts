import { describe, expect, it } from 'bun:test'
import * as path from 'node:path'
import { buildSpawnEnv } from './spawn-env'

describe('buildSpawnEnv', () => {
    it('returns process.env unchanged when extraPath is empty', () => {
        expect(buildSpawnEnv('')).toBe(process.env)
        expect(buildSpawnEnv('   ')).toBe(process.env)
    })

    it('returns process.env unchanged when extraPath only contains separators / whitespace', () => {
        const sep = path.delimiter
        expect(buildSpawnEnv(`${sep}${sep}  `)).toBe(process.env)
    })

    it('prepends extra directories to PATH using the OS separator', () => {
        const sep = path.delimiter
        const original = process.env['PATH']
        process.env['PATH'] = `/usr/bin${sep}/bin`
        try {
            const env = buildSpawnEnv(`/opt/homebrew/bin${sep}/Library/TeX/texbin`)
            expect(env['PATH']).toBe(
                `/opt/homebrew/bin${sep}/Library/TeX/texbin${sep}/usr/bin${sep}/bin`
            )
        } finally {
            process.env['PATH'] = original
        }
    })

    it('handles a missing PATH on the parent env', () => {
        const original = process.env['PATH']
        delete process.env['PATH']
        try {
            const env = buildSpawnEnv('/opt/homebrew/bin')
            expect(env['PATH']).toBe('/opt/homebrew/bin')
        } finally {
            process.env['PATH'] = original
        }
    })

    it('does not mutate process.env', () => {
        const before = process.env['PATH']
        buildSpawnEnv('/opt/homebrew/bin')
        expect(process.env['PATH']).toBe(before)
    })

    it('trims whitespace around individual entries', () => {
        const sep = path.delimiter
        const original = process.env['PATH']
        process.env['PATH'] = '/usr/bin'
        try {
            const env = buildSpawnEnv(`  /opt/homebrew/bin  ${sep}  /Library/TeX/texbin  `)
            expect(env['PATH']).toBe(`/opt/homebrew/bin${sep}/Library/TeX/texbin${sep}/usr/bin`)
        } finally {
            process.env['PATH'] = original
        }
    })
})
