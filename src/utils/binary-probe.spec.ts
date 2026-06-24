import { describe, expect, it } from 'bun:test'
import { resolveEngineBinary, ENGINE_INSTALL_HINT } from './binary-probe'

describe('resolveEngineBinary', () => {
    it('returns the bare engine name when no path is configured', () => {
        expect(resolveEngineBinary('weasyprint', '')).toBe('weasyprint')
        expect(resolveEngineBinary('typst', '   ')).toBe('typst')
    })

    it('forwards the configured path when its basename matches the engine', () => {
        expect(resolveEngineBinary('weasyprint', '/usr/local/bin/weasyprint')).toBe(
            '/usr/local/bin/weasyprint'
        )
        expect(resolveEngineBinary('typst', '/opt/homebrew/bin/typst')).toBe(
            '/opt/homebrew/bin/typst'
        )
    })

    it('matches a basename with an extension (e.g. weasyprint.exe)', () => {
        const arg = resolveEngineBinary('weasyprint', 'C:\\Tools\\weasyprint.exe')
        expect(arg === 'C:\\Tools\\weasyprint.exe' || arg === 'weasyprint').toBe(true)
    })

    it('ignores a path pinned for a different engine (typst path, weasyprint export)', () => {
        expect(resolveEngineBinary('weasyprint', '/opt/homebrew/bin/typst')).toBe('weasyprint')
    })

    it('has an install hint for every supported engine', () => {
        for (const engine of ['typst', 'weasyprint', 'xelatex', 'tectonic']) {
            expect(ENGINE_INSTALL_HINT[engine]).toBeDefined()
        }
    })
})
