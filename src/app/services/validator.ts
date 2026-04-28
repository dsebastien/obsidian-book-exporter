import { TFile, type App } from 'obsidian'
import type { BookEntry, ParsedBook } from '../domain/book-manifest.intf'
import type { ValidationIssue, ValidationReport } from '../domain/export-options.intf'

/**
 * Quality gate before any export. Verifies that the parsed book has the
 * minimum metadata, at least one chapter, and that every wikilink in the TOC
 * points to a real note in the vault.
 */
export class BookValidator {
    constructor(private readonly app: App) {}

    validate(book: ParsedBook): ValidationReport {
        const issues: ValidationIssue[] = []

        if (book.metadata.title.trim().length === 0) {
            issues.push({ level: 'error', message: 'Missing book title.' })
        }
        if (book.metadata.authors.length === 0 || book.metadata.authors[0] === 'Anonymous') {
            issues.push({
                level: 'warning',
                message: 'Missing or default `authors` field — falling back to "Anonymous".'
            })
        }
        if (book.chapters.length === 0) {
            issues.push({
                level: 'error',
                message: 'No chapters found. Make sure the book note has a "Chapters" section with bulleted wikilinks.'
            })
        }

        for (const entry of book.frontMatter) this.validateEntry(entry, issues, 'front matter')
        for (const entry of book.chapters) {
            this.validateEntry(entry, issues, 'chapter')
            for (const section of entry.sections) {
                this.validateEntry(section, issues, `section of "${entry.displayTitle}"`)
            }
        }
        for (const entry of book.backMatter) this.validateEntry(entry, issues, 'back matter')

        if (book.metadata.coverPath !== undefined) {
            // Filesystem check is async-only; defer to runtime in the exporter.
        }

        return {
            book,
            issues,
            hasErrors: issues.some((i) => i.level === 'error')
        }
    }

    private validateEntry(entry: BookEntry, issues: ValidationIssue[], where: string): void {
        const target = this.app.vault.getAbstractFileByPath(entry.filePath)
        if (!(target instanceof TFile)) {
            issues.push({
                level: 'error',
                message: `Unresolved link in ${where}: "${entry.displayTitle}" → ${entry.filePath}`,
                location: entry.filePath
            })
        }
    }
}

export function formatReport(report: ValidationReport): string {
    if (report.issues.length === 0) return 'Validation passed. No issues found.'
    const lines = ['Validation report:']
    for (const issue of report.issues) {
        const prefix = issue.level === 'error' ? '❌' : '⚠️'
        const loc = issue.location !== undefined ? ` (${issue.location})` : ''
        lines.push(`${prefix} ${issue.message}${loc}`)
    }
    return lines.join('\n')
}
