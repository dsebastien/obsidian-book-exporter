import { TFile, type App } from 'obsidian'
import type { BookSection, ParsedBook } from '../domain/book-manifest.intf'
import type { ValidationIssue, ValidationReport } from '../domain/export-options.intf'

/**
 * Quality gate before any export. Verifies that the parsed book has the
 * minimum metadata, at least one section, and that every wikilink in the
 * manifest points to a real note in the vault.
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
        if (book.sections.length === 0) {
            issues.push({
                level: 'error',
                message:
                    'No sections found. The manifest body must contain at least one ## heading with a list of wikilinks underneath.'
            })
        }

        let totalNotes = 0
        for (const section of book.sections) {
            totalNotes += this.validateSection(section, issues, [])
        }
        if (book.sections.length > 0 && totalNotes === 0) {
            issues.push({
                level: 'error',
                message:
                    'Manifest has sections but no resolved note references. Add bulleted wikilinks under your headings.'
            })
        }

        return {
            book,
            issues,
            hasErrors: issues.some((i) => i.level === 'error')
        }
    }

    private validateSection(
        section: BookSection,
        issues: ValidationIssue[],
        ancestors: string[]
    ): number {
        const path = [...ancestors, section.title].filter((p) => p.length > 0).join(' › ')
        let count = 0
        for (const ref of section.notes) {
            const target = this.app.vault.getAbstractFileByPath(ref.filePath)
            if (!(target instanceof TFile)) {
                issues.push({
                    level: 'error',
                    message: `Unresolved link in "${path}": "${ref.displayTitle}" → ${ref.filePath}`,
                    location: ref.filePath
                })
            } else {
                count += 1
            }
        }
        for (const child of section.children) {
            count += this.validateSection(child, issues, [...ancestors, section.title])
        }
        return count
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
