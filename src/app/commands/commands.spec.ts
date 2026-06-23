import { describe, expect, it } from 'bun:test'
import { summarizeOutcomes } from './commands'
import type { ExportOutcome } from '../domain/export-options.intf'

const ok = (format: 'epub' | 'pdf', durationMs: number): ExportOutcome => ({
    format,
    ok: true,
    outputPath: `/out/book.${format}`,
    durationMs
})
const fail = (format: 'epub' | 'pdf', error: string): ExportOutcome => ({
    format,
    ok: false,
    error
})

describe('summarizeOutcomes', () => {
    it('reports all successes with durations', () => {
        const { message, hadFailure } = summarizeOutcomes([ok('epub', 1200), ok('pdf', 3400)])
        expect(hadFailure).toBe(false)
        expect(message).toBe('Book exported: EPUB (1.2s), PDF (3.4s)')
    })

    it('surfaces a partial success — the succeeded format is not hidden by the failure', () => {
        const { message, hadFailure } = summarizeOutcomes([
            ok('epub', 1200),
            fail('pdf', 'pandoc exited with code 43')
        ])
        expect(hadFailure).toBe(true)
        expect(message).toContain('Exported: EPUB (1.2s).')
        expect(message).toContain('Failed: PDF — pandoc exited with code 43')
    })

    it('reports a sole failure clearly', () => {
        const { message, hadFailure } = summarizeOutcomes([fail('pdf', 'typst not found')])
        expect(hadFailure).toBe(true)
        expect(message).not.toContain('Exported:')
        expect(message).toBe('Failed: PDF — typst not found')
    })

    it('truncates very long error messages', () => {
        const long = 'x'.repeat(500)
        const { message } = summarizeOutcomes([fail('pdf', long)])
        expect(message.length).toBeLessThan(220)
        expect(message).toContain('…')
    })
})
