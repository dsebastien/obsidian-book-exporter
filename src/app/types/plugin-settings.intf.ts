import type { ExportFormat, PdfEngine } from '../domain/book-manifest.intf'

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
     * Heading names (case-insensitive) to skip — applied both to the manifest
     * body before parsing (so authoring scaffolding like "Title Options" or
     * "Target Audience" never reaches the export) and to each linked note
     * when it is inlined (so housekeeping sections like "Related" or
     * "References" stay out of the book). Per-book `sections_to_skip`
     * overrides this value.
     */
    sectionsToSkip: string[]

    includeTocByDefault: boolean
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
    sectionsToSkip: ['Related', 'References', 'Title Options', 'Target Audience'],
    includeTocByDefault: true,
    tocDepthDefault: 2,
    pageBreakPerChapterDefault: true,
    defaultFormats: ['epub', 'pdf'],
    keepTempFiles: false,
    debug: false
}
