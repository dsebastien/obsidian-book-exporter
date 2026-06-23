import { describe, expect, it } from 'bun:test'
import {
    convertThematicBreaksToPageBreaks,
    stripFrontmatter,
    stripObsidianComments,
    stripSkippedSections
} from './markdown'

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

describe('stripFrontmatter', () => {
    it('removes a leading YAML frontmatter block', () => {
        const input = '---\ntitle: X\ntags: [a]\n---\n# Heading\nbody'
        expect(stripFrontmatter(input)).toBe('# Heading\nbody')
    })

    it('returns the body unchanged when there is no frontmatter', () => {
        const input = '# Heading\nbody'
        expect(stripFrontmatter(input)).toBe(input)
    })

    it('does not treat a thematic break as frontmatter', () => {
        const input = 'intro\n\n---\n\nmore'
        expect(stripFrontmatter(input)).toBe(input)
    })
})

describe('stripSkippedSections', () => {
    it('drops a skipped section and its body up to the next same-level heading', () => {
        const input = ['## Keep', 'a', '## References', 'x', 'y', '## Also keep', 'b'].join('\n')
        const out = stripSkippedSections(input, ['References'])
        expect(out).toContain('## Keep')
        expect(out).toContain('## Also keep')
        expect(out).not.toContain('## References')
        expect(out).not.toContain('\nx')
    })

    it('matches heading names case-insensitively', () => {
        const out = stripSkippedSections('## TITLE OPTIONS\nx\n## Keep\ny', ['Title Options'])
        expect(out).not.toContain('TITLE OPTIONS')
        expect(out).toContain('## Keep')
    })

    it('keeps a deeper subheading inside a skipped section dropped, then resumes at same level', () => {
        const input = ['## Skip', '### Sub', 'x', '## Keep', 'y'].join('\n')
        const out = stripSkippedSections(input, ['Skip'])
        expect(out).not.toContain('### Sub')
        expect(out).toContain('## Keep')
    })

    it('returns body unchanged when skip list is empty', () => {
        const input = '## A\nx'
        expect(stripSkippedSections(input, [])).toBe(input)
    })
})

describe('convertThematicBreaksToPageBreaks', () => {
    it('replaces a standalone --- line with the page-break literal', () => {
        const out = convertThematicBreaksToPageBreaks('a\n---\nb', '<PB>')
        expect(out).toBe('a\n<PB>\nb')
    })

    it('preserves --- inside a fenced code block', () => {
        const input = ['```', '---', '```'].join('\n')
        expect(convertThematicBreaksToPageBreaks(input, '<PB>')).toBe(input)
    })
})
