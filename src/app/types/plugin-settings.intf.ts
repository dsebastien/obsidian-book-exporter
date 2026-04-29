import type { ExportFormat, InlinedNoteSeparator, PdfEngine } from '../domain/book-manifest.intf'

export interface PluginSettings {
    /** Path or PATH name of the pandoc binary. */
    pandocPath: string
    /**
     * Absolute filesystem path where exported books are written. Supports
     * `~` expansion (e.g. `~/Downloads`). Empty string means "not yet
     * configured" — the plugin refuses to export until the user sets it.
     */
    defaultOutputDir: string
    defaultPdfEngine: PdfEngine
    defaultLanguage: string
    /**
     * Author names used when the manifest doesn't define `authors` in its
     * frontmatter. Empty list ⇒ falls back to "Anonymous" (warning, not
     * error).
     */
    defaultAuthors: string[]

    /**
     * Frontmatter property name read for the cover image. The value can be
     * a vault-relative path, an absolute filesystem path, an Obsidian
     * `[[wikilink]]`, or an `http(s)` URL (downloaded to the temp dir
     * before pandoc runs). Configurable so manifests can use whatever name
     * fits the user's frontmatter conventions (e.g. `cover`, `cover_image`,
     * `cover_url`).
     */
    coverProperty: string

    /**
     * Typst PDF engine requires a `mainfont` and `monofont` to render —
     * without them Pandoc 3.6+ produces a template whose `conf()` fails
     * with "font fallback list must not be empty". These defaults are
     * forwarded to pandoc as `-V mainfont=...` / `-V monofont=...` for PDF
     * exports that don't already define them via `pandoc_extra_args`.
     * Use a font that ships with `typst fonts` on the host (e.g.
     * `Liberation Serif`, `New Computer Modern`, `Noto Serif`).
     */
    defaultMainFont: string
    defaultMonoFont: string

    /**
     * Heading names (case-insensitive) to skip — applied both to the manifest
     * body before parsing (so authoring scaffolding like "Title Options" or
     * "Target Audience" never reaches the export) and to each linked note
     * when it is inlined (so housekeeping sections like "Related" or
     * "References" stay out of the book). Per-book `sections_to_skip`
     * overrides this value.
     */
    sectionsToSkip: string[]

    /**
     * Visual separator emitted between successive inlined notes inside the
     * same manifest section. `none` keeps the legacy run-on behaviour;
     * `rule` adds a centred glyph rule; `blank` adds extra spacing;
     * `subheading` emits the note's display title as a sub-heading. Per-book
     * `book_export.inlined_note_separator` overrides this.
     */
    inlinedNoteSeparator: InlinedNoteSeparator

    includeTocByDefault: boolean
    /**
     * When `tocDepthAuto` is `true` the compiler computes the TOC depth from
     * the deepest heading level actually used in the manifest (e.g. parts +
     * chapters → depth 3). `tocDepthDefault` is then only used as a fallback
     * when the manifest has no parseable headings. When `tocDepthAuto` is
     * `false`, `tocDepthDefault` wins. A per-book `book_export.toc_depth`
     * override beats both.
     */
    tocDepthAuto: boolean
    tocDepthDefault: number
    pageBreakPerChapterDefault: boolean

    /** Formats triggered by the "export all" command when the manifest doesn't override them. */
    defaultFormats: ExportFormat[]

    /** Keep the temp manuscript and resources after a successful export (debug). */
    keepTempFiles: boolean
    /** Verbose console logging. */
    debug: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
    pandocPath: 'pandoc',
    defaultOutputDir: '',
    defaultPdfEngine: 'typst',
    defaultLanguage: 'en',
    defaultAuthors: [],
    coverProperty: 'cover',
    defaultMainFont: 'Liberation Serif',
    defaultMonoFont: 'Liberation Mono',
    sectionsToSkip: ['Related', 'References', 'Title Options', 'Target Audience'],
    inlinedNoteSeparator: 'none',
    includeTocByDefault: true,
    tocDepthAuto: true,
    tocDepthDefault: 2,
    pageBreakPerChapterDefault: true,
    defaultFormats: ['epub', 'pdf'],
    keepTempFiles: false,
    debug: false
}
