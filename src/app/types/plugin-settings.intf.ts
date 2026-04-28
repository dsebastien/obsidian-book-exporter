import type { ExportFormat, PdfEngine } from '../domain/book-manifest.intf'

export interface PluginSettings {
    /** Path or PATH name of the pandoc binary. */
    pandocPath: string
    /** Vault-relative default output folder for exports. */
    defaultOutputDir: string
    defaultPdfEngine: PdfEngine
    defaultLanguage: string

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
    defaultOutputDir: 'Exports/Books',
    defaultPdfEngine: 'typst',
    defaultLanguage: 'en',
    sectionsToSkip: ['Related', 'References', 'Title Options', 'Target Audience'],
    includeTocByDefault: true,
    tocDepthDefault: 2,
    pageBreakPerChapterDefault: true,
    defaultFormats: ['epub', 'pdf'],
    keepTempFiles: false,
    debug: false
}
