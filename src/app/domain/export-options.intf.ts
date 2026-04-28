import type { ExportFormat, ParsedBook } from './book-manifest.intf'

export interface ExportRequest {
    format: ExportFormat
    book: ParsedBook
}

export interface ExportResult {
    format: ExportFormat
    /** Absolute filesystem path of the produced artifact. */
    outputPath: string
    durationMs: number
}

export interface ValidationIssue {
    level: 'error' | 'warning'
    message: string
    /** Optional pointer to the offending note / file. */
    location?: string
}

export interface ValidationReport {
    book?: ParsedBook
    issues: ValidationIssue[]
    /** True when there is at least one `level: 'error'` issue. */
    hasErrors: boolean
}
