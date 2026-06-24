/**
 * Domain types describing a parsed book — its metadata, per-book export
 * overrides, and the heading tree of sections (each holding the wikilinks
 * whose target notes will be inlined).
 *
 * Produced by the `BookParser`. Consumed by the compiler, validator and
 * exporter. Kept free of any Obsidian API to make the parser unit-testable.
 */

// weasyprint is fully supported (#36): the compiler emits `{=html}` matter
// transitions (CSS `@page` named pages + a `:nth(1 of body)` counter reset)
// and an HTML/CSS full-bleed cover, mirroring the Typst/LaTeX output.
// wkhtmltopdf stays out — it's WebKit-based and abandoned, with no usable
// `@page` counter support, so it can't restart body-matter page numbering.
export type PdfEngine = 'typst' | 'xelatex' | 'tectonic' | 'weasyprint'

export type ExportFormat = 'epub' | 'pdf'

/**
 * Visual separator emitted between successive inlined notes within the same
 * manifest section. Default `none` keeps the historical behaviour (notes
 * flow into one another). Other values give the reader a visible cue that
 * one atomic note has ended and the next has begun.
 *
 * - `none` — nothing emitted.
 * - `rule` — Markdown horizontal-rule glyph row (`* * *`). Renders as a
 *   small centred rule in print/EPUB without colliding with the manifest's
 *   `---` page-break syntax.
 * - `blank` — extra blank line (visible spacing, no glyph).
 * - `subheading` — emit the note's display title as a heading one level
 *   below the section heading. Useful when the manifest section groups
 *   several conceptually distinct notes.
 */
export type InlinedNoteSeparator = 'none' | 'rule' | 'blank' | 'subheading'

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
    /**
     * Absolute filesystem path of the bibliography file (`.bib`, `.json`,
     * `.yaml`, etc.) once resolved from the manifest's `bibliography:`
     * frontmatter. When set, the exporter passes `--citeproc` to pandoc
     * and writes the path into the metadata YAML so pandoc-citeproc
     * resolves citations like `[@smith2020]`.
     */
    bibliographyPath?: string
    /**
     * Absolute path of the optional CSL stylesheet (`csl:` frontmatter).
     * Forwarded to pandoc as the citation style. Pandoc has a usable
     * default when this is omitted.
     */
    cslPath?: string
}

export interface BookExportOverrides {
    /** Vault-relative output folder. */
    outputDir?: string
    pdfEngine?: PdfEngine
    /** `--toc-depth` passed to pandoc. */
    tocDepth?: number
    includeToc?: boolean
    pageBreakPerChapter?: boolean
    /** `--number-sections` flag forwarded to pandoc. */
    numberSections?: boolean
    /** Formats kicked off by the "export all" command. */
    formats?: ExportFormat[]
    /** Extra raw arguments forwarded to pandoc verbatim. */
    pandocExtraArgs?: string[]
    /** Paper size for PDF exports, e.g. `a4`, `us-letter`, `a5`. */
    pageSize?: string
    /** Uniform page margin with unit, e.g. `2cm`, `1in`. */
    pageMargin?: string
    /** Line spacing as a unitless multiple, e.g. `1.5`. */
    lineSpacing?: string
    /** Base font size with unit, e.g. `11pt` (a bare number gets `pt` appended). */
    baseFontSize?: string
    /**
     * Heading names (case-insensitive) to skip — applied both to the manifest
     * body before parsing (so authoring scaffolding like `Title Options`,
     * `Target Audience`, `Related`, ... stays in the manifest but never
     * reaches the export) and to each linked note when it is inlined.
     * Overrides the plugin-level default.
     */
    sectionsToSkip?: string[]
    /** Per-book override for the visual separator between inlined notes. */
    inlinedNoteSeparator?: InlinedNoteSeparator
    /**
     * Top-level section titles (case-insensitive) treated as front matter.
     * Front-matter pages are numbered with lowercase roman numerals (`i`,
     * `ii`, ...); the first non-matching top-level section starts body
     * matter and resets numbering to arabic (`1`, `2`, ...). Only emits
     * meaningful raw blocks for Typst and LaTeX targets — HTML/EPUB
     * ignore them. When undefined, the whole book is body matter.
     */
    frontMatterSections?: string[]
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
 * A heading in the manifest body. Holds:
 * - the prose written directly under the heading (any non-heading line that
 *   isn't a bullet containing a wikilink — paragraphs, plain bullets,
 *   tables, code fences, blockquotes...). Preserved verbatim and emitted
 *   between the section's heading and its referenced notes.
 * - the notes referenced by bulleted wikilinks under this heading, in
 *   source order. Their content is inlined after the prose.
 * - the nested sub-sections.
 */
export interface BookSection {
    /** Heading level (2..6). */
    level: number
    title: string
    prose: string
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
    /**
     * Deepest heading level encountered while walking the manifest tree
     * (2..6, or `0` when the manifest has no parseable section).
     * Lets the exporter pick a TOC depth that matches the actual structure
     * without forcing the user to set `toc_depth` per book.
     */
    maxHeadingLevel: number
}
