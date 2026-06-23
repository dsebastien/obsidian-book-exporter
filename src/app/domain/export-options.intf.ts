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

/**
 * Per-format result of an export run. Unlike a thrown error, a failed format
 * does not abort the formats that follow it — each format reports its own
 * outcome so a partial success (e.g. EPUB ok, PDF failed) can be surfaced.
 */
export type ExportOutcome =
    | { format: ExportFormat; ok: true; outputPath: string; durationMs: number }
    | { format: ExportFormat; ok: false; error: string }

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
