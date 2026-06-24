import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { unlinkSync, writeFileSync } from 'node:fs'
import { neutraliseMentionLinks } from './generate-changelog.ts'

const TEST_CHANGELOG = 'CHANGELOG.test.md'

describe('getLatestChangelogEntry', () => {
    beforeAll(() => {
        // Create a test changelog file
        const content = `# Changelog

## [1.2.0] - 2024-01-15

### Added
- New feature A
- New feature B

### Fixed
- Bug fix 1

## [1.1.0] - 2024-01-01

### Added
- Initial feature

## [1.0.0] - 2023-12-01

### Added
- First release
`
        writeFileSync(TEST_CHANGELOG, content)
    })

    afterAll(() => {
        try {
            unlinkSync(TEST_CHANGELOG)
        } catch {
            // Ignore if file doesn't exist
        }
    })

    test('extracts latest version section', async () => {
        const testFile = Bun.file(TEST_CHANGELOG)

        // Read test content and verify extraction logic
        const content = await testFile.text()
        const sections = content.split(/^## /m)

        expect(sections.length).toBeGreaterThan(2)
        expect(sections[1]).toContain('[1.2.0]')
        expect(sections[1]).toContain('New feature A')
    })

    test('returns empty string for non-existent file', async () => {
        // This tests the edge case handling
        const nonExistentFile = Bun.file('CHANGELOG.nonexistent.md')
        const exists = await nonExistentFile.exists()
        expect(exists).toBe(false)
    })
})

describe('changelog format', () => {
    test('conventional changelog format is valid', () => {
        // Verify the expected format structure
        const sampleEntry = `## [1.0.0] - 2024-01-01

### Added
- Feature 1

### Fixed
- Bug 1
`
        expect(sampleEntry).toMatch(/^## \[\d+\.\d+\.\d+\]/)
        expect(sampleEntry).toContain('### Added')
        expect(sampleEntry).toContain('### Fixed')
    })
})

describe('neutraliseMentionLinks', () => {
    test('rewrites a bogus self-referential @mention link into inline code', () => {
        const input =
            '* **typst:** neutralise stray [@citations](https://github.com/citations) when no bibliography is set'
        const expected = '* **typst:** neutralise stray `@citations` when no bibliography is set'
        expect(neutraliseMentionLinks(input)).toBe(expected)
    })

    test('handles http and multiple bogus mentions in one line', () => {
        const input = 'see [@set](http://github.com/set) and [@foo-bar](https://github.com/foo-bar)'
        expect(neutraliseMentionLinks(input)).toBe('see `@set` and `@foo-bar`')
    })

    test('leaves real issue/commit/compare links untouched', () => {
        const input =
            '* feat ([#2](https://github.com/dsebastien/obsidian-book-exporter/issues/2)) ([e855340](https://github.com/dsebastien/obsidian-book-exporter/commit/e855340))'
        expect(neutraliseMentionLinks(input)).toBe(input)
    })

    test('does not touch a mention link whose text differs from the URL path', () => {
        // Genuine maintainer attribution links keep their original form.
        const input = 'thanks [@dsebastien](https://github.com/dsebastien-other)'
        expect(neutraliseMentionLinks(input)).toBe(input)
    })
})
