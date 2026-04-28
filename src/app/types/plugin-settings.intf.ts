import type { ExportFormat, PdfEngine } from '../domain/book-manifest.intf'

export interface PluginSettings {
    /** Path or PATH name of the pandoc binary. */
    pandocPath: string
    /** Vault-relative default output folder for exports. */
    defaultOutputDir: string
    defaultPdfEngine: PdfEngine
    defaultLanguage: string

    /** Body heading that introduces the front-matter list (default: "Front Matter"). */
    frontMatterHeading: string
    /** Body heading that introduces the chapters list (default: "Chapters"). */
    chaptersHeading: string
    /** Body heading that introduces the back-matter list (default: "Back Matter"). */
    backMatterHeading: string

    includeTocByDefault: boolean
    tocDepthDefault: number
    pageBreakPerChapterDefault: boolean

    /** Formats triggered by the "export all" command when the book note doesn't override them. */
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
    frontMatterHeading: 'Front Matter',
    chaptersHeading: 'Chapters',
    backMatterHeading: 'Back Matter',
    includeTocByDefault: true,
    tocDepthDefault: 2,
    pageBreakPerChapterDefault: true,
    defaultFormats: ['epub', 'pdf'],
    keepTempFiles: false,
    debug: false
}
