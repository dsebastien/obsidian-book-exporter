import { describe, expect, it } from 'bun:test'
import {
    convertThematicBreaksToPageBreaks,
    extractBlock,
    extractSection,
    parseEmbedTarget,
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

describe('parseEmbedTarget', () => {
    it('returns no anchor for a bare note name', () => {
        expect(parseEmbedTarget('Some Note')).toEqual({ linkpath: 'Some Note', anchor: null })
    })

    it('parses the loose `Note^id` block syntax (issue #50)', () => {
        expect(parseEmbedTarget('literature note^2345fr')).toEqual({
            linkpath: 'literature note',
            anchor: { type: 'block', blockId: '2345fr' }
        })
    })

    it('parses the canonical `Note#^id` block syntax', () => {
        expect(parseEmbedTarget('Note#^abc')).toEqual({
            linkpath: 'Note',
            anchor: { type: 'block', blockId: 'abc' }
        })
    })

    it('parses a heading anchor', () => {
        expect(parseEmbedTarget('Note#Chapter One')).toEqual({
            linkpath: 'Note',
            anchor: { type: 'heading', headingPath: ['Chapter One'] }
        })
    })

    it('parses a heading chain into a subheading', () => {
        expect(parseEmbedTarget('Note#H1#H2')).toEqual({
            linkpath: 'Note',
            anchor: { type: 'heading', headingPath: ['H1', 'H2'] }
        })
    })
})

describe('extractBlock', () => {
    it('extracts a single-line block and strips the trailing ^id (issue #50)', () => {
        const body = ['intro para', '', 'the referenced block ^2345fr', '', 'later para'].join('\n')
        expect(extractBlock(body, '2345fr')).toBe('the referenced block')
    })

    it('extracts a multi-line block surrounding the marker', () => {
        const body = ['', 'line one', 'line two ^id', '', 'next'].join('\n')
        expect(extractBlock(body, 'id')).toBe('line one\nline two')
    })

    it('extracts the preceding paragraph when the id is on its own line', () => {
        const body = ['para a', '', '| h |', '| - |', '| x |', '^tbl', '', 'after'].join('\n')
        expect(extractBlock(body, 'tbl')).toBe('| h |\n| - |\n| x |')
    })

    it('returns null when the block id is absent', () => {
        expect(extractBlock('no markers here', 'missing')).toBeNull()
    })
})

describe('extractSection', () => {
    const body = [
        '# Title',
        'preamble',
        '## Wanted',
        'wanted body',
        '### Sub',
        'sub body',
        '## Other',
        'other body'
    ].join('\n')

    it('extracts a heading section up to the next same-level heading (issue #50)', () => {
        expect(extractSection(body, ['Wanted'])).toBe(
            ['## Wanted', 'wanted body', '### Sub', 'sub body'].join('\n')
        )
    })

    it('matches headings case-insensitively', () => {
        expect(extractSection(body, ['wanted'])).toContain('## Wanted')
    })

    it('drills into a subheading via a heading chain', () => {
        expect(extractSection(body, ['Wanted', 'Sub'])).toBe(['### Sub', 'sub body'].join('\n'))
    })

    it('returns null when the heading is absent', () => {
        expect(extractSection(body, ['Nope'])).toBeNull()
    })

    it('ignores a `#` that is inside a code fence', () => {
        const fenced = ['## Real', 'x', '```', '## Fake', '```', '## End'].join('\n')
        expect(extractSection(fenced, ['Fake'])).toBeNull()
    })
})
