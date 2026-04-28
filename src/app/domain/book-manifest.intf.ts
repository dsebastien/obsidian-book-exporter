/**
 * Domain types describing a parsed book — its metadata, per-book export
 * overrides, and the ordered list of notes that make up the manuscript.
 *
 * Produced by the `BookParser`. Consumed by the compiler, validator and
 * exporter. Kept free of any Obsidian API to make the parser unit-testable.
 */

export type PdfEngine = 'typst' | 'weasyprint' | 'xelatex' | 'tectonic' | 'wkhtmltopdf'

export type ExportFormat = 'epub' | 'pdf'

export interface BookMetadata {
    title: string
    authors: string[]
    language: string
    isbn?: string
    publisher?: string
    datePublished?: string
    description?: string
    /**
     * Absolute filesystem path to the cover image once resolved. Stays
     * `undefined` when the book note doesn't define one.
     */
    coverPath?: string
    rights?: string
    subject?: string[]
}

export interface BookExportOverrides {
    /** Vault-relative output folder. */
    outputDir?: string
    pdfEngine?: PdfEngine
    /** `--toc-depth` passed to pandoc. */
    tocDepth?: number
    includeToc?: boolean
    pageBreakPerChapter?: boolean
    /** Formats kicked off by the "export all" command. */
    formats?: ExportFormat[]
    /** Extra raw arguments forwarded to pandoc verbatim. */
    pandocExtraArgs?: string[]
}

/**
 * One entry in the book's TOC. Chapters live under `Chapters`; entries can
 * have nested `sections` (only chapters do, in the MVP).
 */
export interface BookEntry {
    /** Vault-relative path of the linked note. */
    filePath: string
    /** Title rendered in the manuscript (alias from the wikilink, or basename). */
    displayTitle: string
    /** Sections nested under this entry. Empty for non-chapter entries. */
    sections: BookEntry[]
}

export interface ParsedBook {
    /** Vault-relative path of the book note itself. */
    bookNotePath: string
    metadata: BookMetadata
    overrides: BookExportOverrides
    frontMatter: BookEntry[]
    chapters: BookEntry[]
    backMatter: BookEntry[]
}
