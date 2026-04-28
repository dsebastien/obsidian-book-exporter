/**
 * Domain types describing a parsed book — its metadata, per-book export
 * overrides, and the heading tree of sections (each holding the wikilinks
 * whose target notes will be inlined).
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
     * `undefined` when the manifest doesn't define one.
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
    /**
     * Heading names (case-insensitive) to skip — applied both to the manifest
     * body before parsing (so authoring scaffolding like `Title Options`,
     * `Target Audience`, `Related`, ... stays in the manifest but never
     * reaches the export) and to each linked note when it is inlined.
     * Overrides the plugin-level default.
     */
    sectionsToSkip?: string[]
}

/**
 * One wikilink-resolved reference to a note that will be inlined at a given
 * point in the book.
 */
export interface NoteReference {
    /** Vault-relative path of the linked note. */
    filePath: string
    /** Display title from the wikilink alias, or the note's basename. */
    displayTitle: string
}

/**
 * A heading in the manifest body. Holds the notes referenced by bullets
 * directly under it (in source order) and the nested sub-sections.
 */
export interface BookSection {
    /** Heading level (2..6). */
    level: number
    title: string
    notes: NoteReference[]
    children: BookSection[]
}

export interface ParsedBook {
    /** Vault-relative path of the manifest note itself. */
    bookNotePath: string
    metadata: BookMetadata
    overrides: BookExportOverrides
    /**
     * Top-level sections in body order. Typically all the same level
     * (the lowest non-1 heading level the manifest uses).
     */
    sections: BookSection[]
}
