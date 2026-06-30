/**
 * Generates or updates CHANGELOG.md using conventional-changelog.
 * Also syncs to docs/release-notes.md for documentation.
 * Usage: bun scripts/generate-changelog.ts
 */

import { $ } from 'bun'

const CHANGELOG_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

`

/**
 * Neutralises bogus GitHub @mention links that conventional-changelog generates
 * for code-ish `@token`s appearing in commit subjects (e.g. a Typst `@citations`
 * reference or a `@set` directive).
 *
 * conventional-changelog treats a leading `@token` as a GitHub @mention and turns
 * it into a self-referential profile link `[@token](https://github.com/token)`.
 * For non-user tokens this is wrong (see the 0.0.8 release notes). We rewrite such
 * auto-generated mention links — those where the displayed handle is identical to
 * the URL path — into inline code (`` `@token` ``) so they render as plain text and
 * GitHub does not re-autolink them when the changelog is shown in release notes.
 *
 * Real issue/commit/compare links (e.g. `[#2](https://github.com/owner/repo/issues/2)`)
 * are left untouched because their link text never equals the URL path.
 */
export function neutraliseMentionLinks(text: string): string {
    return text.replace(/\[@([A-Za-z0-9-]+)\]\(https?:\/\/github\.com\/\1\)/g, '`@$1`')
}

export async function generateChangelog(): Promise<string> {
    const changelogFile = Bun.file('CHANGELOG.md')

    // Read existing changelog content (excluding header)
    let existingContent = ''
    if (await changelogFile.exists()) {
        const content = await changelogFile.text()
        // Remove the header if present (everything before first ## version line)
        const match = content.match(/^(## \[?\d)/m)
        if (match?.index !== undefined) {
            existingContent = content.substring(match.index)
        } else if (!content.startsWith('#')) {
            // No header, keep all content
            existingContent = content
        }
    }

    // Generate new changelog entry to stdout
    const rawEntry = await $`bunx conventional-changelog -p conventionalcommits -r 1`.text()
    // Neutralise bogus @mention links (e.g. `@citations`) before writing.
    const newEntry = neutraliseMentionLinks(rawEntry)

    // Combine header + new entry + existing content
    const finalContent =
        CHANGELOG_HEADER +
        newEntry.trim() +
        (existingContent ? '\n\n' + existingContent : '') +
        '\n'

    // Write the combined content
    await Bun.write('CHANGELOG.md', finalContent)

    return newEntry
}

export async function getLatestChangelogEntry(): Promise<string> {
    const changelogFile = Bun.file('CHANGELOG.md')
    if (!(await changelogFile.exists())) {
        return ''
    }

    const content = await changelogFile.text()
    // Extract the latest version section (between first and second ## headers)
    const sections = content.split(/^## /m)
    if (sections.length < 2) {
        return content
    }
    // Return the first version section (sections[0] is content before first ##)
    return '## ' + (sections[1] ?? '')
}

/**
 * Converts CHANGELOG.md format to docs/release-notes.md format.
 * Strips GitHub links and commit hashes for cleaner documentation.
 */
export async function syncToDocsReleaseNotes(): Promise<void> {
    const changelogFile = Bun.file('CHANGELOG.md')
    if (!(await changelogFile.exists())) {
        console.log('No CHANGELOG.md found, skipping docs sync.')
        return
    }

    // Check if docs folder exists
    try {
        const stat = await Bun.file('docs/README.md').exists()
        if (!stat) {
            console.log('No docs folder found, skipping docs sync.')
            return
        }
    } catch {
        console.log('No docs folder found, skipping docs sync.')
        return
    }

    const content = await changelogFile.text()

    // Transform changelog to release notes format:
    // 1. Remove commit links like ([abc1234](https://...))
    // 2. Remove issue links like , closes [#123](https://...)
    // 3. Simplify version headers from ## [1.0.0](link) (date) to ## 1.0.0 (date)
    let releaseNotes = content
        // Remove commit hash links
        .replace(/\s*\(\[[a-f0-9]+\]\([^)]+\)\)/g, '')
        // Remove "closes #XX" links
        .replace(/,?\s*closes\s*\[#\d+\]\([^)]+\)/gi, '')
        // Simplify version headers: ## [1.0.0](link) (date) -> ## 1.0.0 (date)
        .replace(/^## \[([^\]]+)\]\([^)]+\)/gm, '## $1')
        // Replace "Changelog" header with "Release Notes"
        .replace(/^# Changelog/m, '# Release Notes')
        // Remove the "All notable changes..." line
        .replace(/^All notable changes to this project will be documented in this file\.\n\n/m, '')

    // Neutralise bogus @mention links so previously generated entries are also cleaned.
    releaseNotes = neutraliseMentionLinks(releaseNotes)

    // Clean up any double blank lines
    releaseNotes = releaseNotes.replace(/\n{3,}/g, '\n\n')

    await Bun.write('docs/release-notes.md', releaseNotes)
}

// Only run if executed directly
if (import.meta.main) {
    console.log('Generating changelog...')
    await generateChangelog()
    console.log('Changelog updated successfully.')

    console.log('Syncing to docs/release-notes.md...')
    await syncToDocsReleaseNotes()
    console.log('Docs release notes synced successfully.')

    const latestEntry = await getLatestChangelogEntry()
    console.log('\n--- Latest changelog entry ---')
    console.log(latestEntry)
}
