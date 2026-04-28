import type { ExportFormat, PdfEngine } from '../domain/book-manifest.intf'

export interface PluginSettings {
    /** Path or PATH name of the pandoc binary. */
    pandocPath: string
    /** Vault-relative default output folder for exports. */
    defaultOutputDir: string
    defaultPdfEngine: PdfEngine
    defaultLanguage: string

    /**
     * Heading names (case-insensitive) to strip from linked notes when
     * inlining them — typically housekeeping sections like "Related" or
     * "References" that don't belong in a book. Per-book `sectionsToSkip`
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
    sectionsToSkip: ['Related', 'References'],
    includeTocByDefault: true,
    tocDepthDefault: 2,
    pageBreakPerChapterDefault: true,
    defaultFormats: ['epub', 'pdf'],
    keepTempFiles: false,
    debug: false
}
