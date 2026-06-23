import { describe, expect, it } from 'bun:test'
import { stripObsidianComments } from './markdown'

describe('stripObsidianComments', () => {
    it('removes an inline single-line comment', () => {
        expect(stripObsidianComments('text %% hidden %% more')).toBe('text  more')
    })

    it('removes a comment that spans multiple lines (issue #11)', () => {
        const input = ['before', '%%', 'secret note', 'still secret', '%%', 'after'].join('\n')
        const out = stripObsidianComments(input)
        expect(out).not.toContain('secret')
        expect(out.split('\n')[0]).toBe('before')
        expect(out.trimEnd().endsWith('after')).toBe(true)
    })

    it('removes a comment that opens and closes mid-line across lines', () => {
        const input = ['keep a %%', 'drop me', '%% keep b'].join('\n')
        const out = stripObsidianComments(input)
        expect(out).toContain('keep a')
        expect(out).toContain('keep b')
        expect(out).not.toContain('drop me')
    })

    it('preserves %% inside a fenced code block', () => {
        const input = ['```', 'let x = a %% b', '```'].join('\n')
        expect(stripObsidianComments(input)).toBe(input)
    })

    it('leaves text without comments unchanged', () => {
        const input = 'a normal paragraph\n\nwith two lines'
        expect(stripObsidianComments(input)).toBe(input)
    })

    it('handles multiple comments on one line', () => {
        expect(stripObsidianComments('a %%x%% b %%y%% c')).toBe('a  b  c')
    })
})
