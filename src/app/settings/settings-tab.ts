import { Notice, PluginSettingTab, Setting } from 'obsidian'
import type { App, SettingDefinitionItem } from 'obsidian'
import type BookExporterPlugin from '../../main'
import type { ExportFormat, InlinedNoteSeparator, PdfEngine } from '../domain/book-manifest.intf'
import { BUY_ME_A_COFFEE_URL, renderSupportSection } from '../ui/support-links'

const PDF_ENGINES: PdfEngine[] = ['typst', 'xelatex', 'tectonic', 'weasyprint']
const FORMATS: ExportFormat[] = ['epub', 'pdf']
const NOTE_SEPARATOR_OPTIONS: Record<InlinedNoteSeparator, string> = {
    none: 'None — notes flow into one another (legacy)',
    rule: 'Glyph rule (* * *)',
    blank: 'Blank line',
    subheading: 'Note title as sub-heading'
}

/**
 * Settings tab, declared rather than rendered (Obsidian 1.13+).
 *
 * `getSettingDefinitions()` REPLACES `display()` — Obsidian owns navigation,
 * focus and ARIA, and every declared `name`/`desc` is indexed by the settings
 * search. Every scalar is a `control` definition addressed by its
 * `PluginSettings` field name; `getControlValue`/`setControlValue` bridge to
 * `plugin.updateSettings`, the single persistence path. List-valued fields
 * (formats, authors, sections to skip) are presented as comma-separated text,
 * with the same parse/normalize transforms the imperative tab applied.
 *
 * See AGENTS.md "Declarative settings" for the trap list;
 * `settings-guard.spec.ts` enforces the statically-catchable rules.
 */
export class BookExporterSettingTab extends PluginSettingTab {
    plugin: BookExporterPlugin

    constructor(app: App, plugin: BookExporterPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    override getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            this.toolsGroup(),
            this.outputGroup(),
            this.processingGroup(),
            this.renderingGroup(),
            this.debugGroup(),
            this.supportGroup()
        ]
    }

    // ----- Control value plumbing -----

    /** Text controls hand us `unknown`; anything that isn't a string is refused. */
    private static asString(this: void, value: unknown): string {
        if (typeof value !== 'string') {
            throw new Error('Expected a text value.')
        }
        return value
    }

    private static asBoolean(this: void, value: unknown): boolean {
        if (typeof value !== 'boolean') {
            throw new Error('Expected a boolean value.')
        }
        return value
    }

    override getControlValue(key: string): unknown {
        const s = this.plugin.settings
        switch (key) {
            case 'pandocPath':
                return s.pandocPath
            case 'pdfEnginePath':
                return s.pdfEnginePath
            case 'extraPath':
                return s.extraPath
            case 'defaultOutputDir':
                return s.defaultOutputDir
            case 'defaultFormats':
                return s.defaultFormats.join(',')
            case 'openAfterExport':
                return s.openAfterExport
            case 'defaultPdfEngine':
                return s.defaultPdfEngine
            case 'defaultLanguage':
                return s.defaultLanguage
            case 'defaultAuthors':
                return s.defaultAuthors.join(', ')
            case 'coverProperty':
                return s.coverProperty
            case 'inlineNoteEmbeds':
                return s.inlineNoteEmbeds
            case 'noteEmbedMaxDepth':
                return s.noteEmbedMaxDepth
            case 'inlinedNoteSeparator':
                return s.inlinedNoteSeparator
            case 'sectionsToSkip':
                return s.sectionsToSkip.join(', ')
            case 'defaultMainFont':
                return s.defaultMainFont
            case 'defaultMonoFont':
                return s.defaultMonoFont
            case 'typstImageWidth':
                return s.typstImageWidth
            case 'pageSize':
                return s.pageSize
            case 'pageMargin':
                return s.pageMargin
            case 'lineSpacing':
                return s.lineSpacing
            case 'baseFontSize':
                return s.baseFontSize
            case 'includeTocByDefault':
                return s.includeTocByDefault
            case 'tocDepthAuto':
                return s.tocDepthAuto
            case 'tocDepthDefault':
                return s.tocDepthDefault
            case 'numberSections':
                return s.numberSections
            case 'pageBreakPerChapterDefault':
                return s.pageBreakPerChapterDefault
            case 'keepTempFiles':
                return s.keepTempFiles
            case 'debug':
                return s.debug
            default:
                return undefined
        }
    }

    /**
     * Rejecting (not resolving) on failure is load-bearing: a fulfilled
     * promise tells the framework the write landed, and the pane would keep
     * showing a value that was never stored.
     */
    override async setControlValue(key: string, value: unknown): Promise<void> {
        const asString = BookExporterSettingTab.asString
        const asBoolean = BookExporterSettingTab.asBoolean
        const write = async (mutator: Parameters<BookExporterPlugin['updateSettings']>[0]) => {
            await this.plugin.updateSettings(mutator)
        }
        switch (key) {
            // Empty-string collapses mirror the imperative tab's behavior.
            case 'pandocPath': {
                const v = asString(value).trim() || 'pandoc'
                await write((d) => {
                    d.pandocPath = v
                })
                return
            }
            case 'pdfEnginePath':
            case 'extraPath':
            case 'defaultOutputDir':
            case 'defaultMainFont':
            case 'defaultMonoFont':
            case 'typstImageWidth':
            case 'pageSize':
            case 'pageMargin':
            case 'lineSpacing':
            case 'baseFontSize': {
                const v = asString(value).trim()
                await write((d) => {
                    d[key] = v
                })
                return
            }
            case 'defaultLanguage': {
                const v = asString(value).trim() || 'en'
                await write((d) => {
                    d.defaultLanguage = v
                })
                return
            }
            case 'coverProperty': {
                const v = asString(value).trim() || 'cover'
                await write((d) => {
                    d.coverProperty = v
                })
                return
            }
            case 'defaultFormats': {
                const formats = parseFormats(asString(value))
                await write((d) => {
                    d.defaultFormats = formats
                })
                return
            }
            case 'defaultAuthors': {
                const authors = parseList(asString(value))
                await write((d) => {
                    d.defaultAuthors = authors
                })
                return
            }
            case 'sectionsToSkip': {
                const list = parseList(asString(value))
                await write((d) => {
                    d.sectionsToSkip = list
                })
                return
            }
            case 'defaultPdfEngine': {
                const engine = PDF_ENGINES.find((e) => e === value)
                if (!engine) {
                    throw new Error(`Unknown PDF engine "${String(value)}".`)
                }
                await write((d) => {
                    d.defaultPdfEngine = engine
                })
                return
            }
            case 'inlinedNoteSeparator': {
                const sep = (Object.keys(NOTE_SEPARATOR_OPTIONS) as InlinedNoteSeparator[]).find(
                    (k) => k === value
                )
                if (!sep) {
                    throw new Error(`Unknown separator "${String(value)}".`)
                }
                await write((d) => {
                    d.inlinedNoteSeparator = sep
                })
                return
            }
            case 'noteEmbedMaxDepth': {
                if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
                    throw new Error('Depth must be a number of 1 or more.')
                }
                const depth = Math.floor(value)
                await write((d) => {
                    d.noteEmbedMaxDepth = depth
                })
                return
            }
            case 'tocDepthDefault': {
                if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
                    throw new Error('TOC depth must be a positive number.')
                }
                const depth = Math.floor(value)
                await write((d) => {
                    d.tocDepthDefault = depth
                })
                return
            }
            case 'openAfterExport':
            case 'inlineNoteEmbeds':
            case 'includeTocByDefault':
            case 'tocDepthAuto':
            case 'numberSections':
            case 'pageBreakPerChapterDefault':
            case 'keepTempFiles':
            case 'debug': {
                const v = asBoolean(value)
                await write((d) => {
                    d[key] = v
                })
                return
            }
            default:
                new Notice('Book Exporter: failed to save settings.')
                throw new Error(`Setting "${key}" does not address a known field.`)
        }
    }

    // ----- Sections -----

    private toolsGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'External tools',
            items: [
                {
                    name: 'Pandoc path',
                    desc: 'Required. Full path to the pandoc binary, or just `pandoc` to rely on $PATH.',
                    control: { type: 'text', key: 'pandocPath', placeholder: 'pandoc' }
                },
                {
                    name: 'PDF engine path',
                    desc: 'Optional. Full path to the PDF engine binary (e.g. /opt/homebrew/bin/typst, /Library/TeX/texbin/xelatex). Forwarded to pandoc as `--pdf-engine=<path>`, bypassing $PATH lookup. Useful on macOS where Obsidian (Electron) starts with a stripped $PATH that does not include Homebrew or MacTeX. Leave empty to rely on $PATH. Only used when the basename matches the selected PDF engine — switching engines without updating this field falls back to $PATH lookup.',
                    control: {
                        type: 'text',
                        key: 'pdfEnginePath',
                        placeholder: '/opt/homebrew/bin/typst'
                    }
                },
                {
                    name: 'Extra PATH directories',
                    desc: 'Optional. Directories prepended to $PATH for pandoc and helper binaries it spawns (typst, xelatex, ...). Use `:` to separate entries on macOS/Linux (e.g. /opt/homebrew/bin:/Library/TeX/texbin), `;` on Windows. Lets pandoc find PDF engines without specifying full paths for each. Leave empty to use the inherited PATH unchanged.',
                    control: {
                        type: 'text',
                        key: 'extraPath',
                        placeholder: '/opt/homebrew/bin:/Library/TeX/texbin'
                    }
                }
            ]
        }
    }

    private outputGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Output',
            items: [
                {
                    name: 'Default output folder',
                    desc: 'Required. Absolute filesystem path where exported books are written. `~` is expanded to your home directory. The plugin refuses to export until this is set. Example: ~/Downloads or /home/me/Books.',
                    control: { type: 'text', key: 'defaultOutputDir', placeholder: '~/Downloads' }
                },
                {
                    name: 'Default formats',
                    desc: 'Comma-separated list. Used by "Export to all formats" when the manifest doesn\'t specify any.',
                    control: { type: 'text', key: 'defaultFormats', placeholder: 'epub,pdf' }
                },
                {
                    name: 'Open output after export',
                    desc: 'After a successful export, open the produced file with your OS default handler. When several formats succeed, opens their output folder instead. The success notice is always clickable to open it manually.',
                    control: { type: 'toggle', key: 'openAfterExport' }
                },
                {
                    name: 'PDF engine',
                    desc: 'Pandoc PDF engine used unless the book overrides it. Typst is recommended — single small binary, no LaTeX install needed.',
                    control: {
                        type: 'dropdown',
                        key: 'defaultPdfEngine',
                        options: Object.fromEntries(PDF_ENGINES.map((e) => [e, e]))
                    }
                },
                {
                    name: 'Default language',
                    desc: "BCP-47 code (en, fr, ...) used when the manifest doesn't set one.",
                    control: { type: 'text', key: 'defaultLanguage', placeholder: 'en' }
                },
                {
                    name: 'Default author(s)',
                    desc: 'Comma-separated list. Used when the manifest doesn\'t define `authors:` in its frontmatter. Leave empty to fall back to "Anonymous".',
                    control: {
                        type: 'text',
                        key: 'defaultAuthors',
                        placeholder: 'Sébastien Dubois'
                    }
                }
            ]
        }
    }

    private processingGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Note processing',
            items: [
                {
                    name: 'Cover frontmatter property',
                    desc: 'Frontmatter key read for the book cover. Value can be a vault-relative path, an absolute path, an [[wikilink]], or an http(s) URL (downloaded to the temp folder before Pandoc runs). Default: cover.',
                    control: { type: 'text', key: 'coverProperty', placeholder: 'cover' }
                },
                {
                    name: 'Inline note embeds',
                    desc: "When on, `![[Note]]` embeds inside inlined notes are recursively expanded with the embedded note's body. Default off — embeds are dropped (only image embeds are kept). Cycle detection and the depth limit below keep recursion safe.",
                    control: { type: 'toggle', key: 'inlineNoteEmbeds' }
                },
                {
                    name: 'Note embed max depth',
                    desc: 'Maximum recursion depth for note-embed expansion. 1 = direct embeds only; 2 = embeds of embeds; etc. Embeds at the depth limit are replaced with their display title.',
                    control: {
                        type: 'number',
                        key: 'noteEmbedMaxDepth',
                        min: 1,
                        step: 1,
                        // No defaultValue on purpose: a cleared field must be
                        // refused inline, not silently reset by the framework.
                        validate: (value): string | void => {
                            if (!Number.isFinite(value) || value < 1) {
                                return 'Enter a depth of 1 or more.'
                            }
                        }
                    }
                },
                {
                    name: 'Inlined-note separator',
                    desc: 'How successive notes inside the same manifest section are separated visually. "None" keeps the legacy run-on behaviour; "Glyph rule" emits a centred `* * *` between notes; "Blank line" adds extra spacing; "Note title as sub-heading" renders each note\'s display title as a heading one level below the section heading. Per-book override: `book_export.inlined_note_separator`.',
                    control: {
                        type: 'dropdown',
                        key: 'inlinedNoteSeparator',
                        options: NOTE_SEPARATOR_OPTIONS
                    }
                },
                {
                    name: 'Sections to skip',
                    desc: 'Comma-separated list of heading names (case-insensitive) to skip. Applied to the manifest before parsing (drops authoring scaffolding like "Title Options", "Target Audience") and to each linked note when inlining (drops housekeeping sections like "Related", "References").',
                    control: {
                        type: 'textarea',
                        key: 'sectionsToSkip',
                        placeholder: 'Related, References, Title Options, Target Audience'
                    }
                }
            ]
        }
    }

    private renderingGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Rendering',
            items: [
                {
                    name: 'PDF main font',
                    desc: 'Forwarded to pandoc as `-V mainfont=…` for PDF exports. Required by Pandoc 3.6+ Typst (an empty font causes "font fallback list must not be empty"). Use a font reported by `typst fonts` on this machine — e.g. Liberation Serif, New Computer Modern, Noto Serif. Overridable per book via `pandoc_extra_args`.',
                    control: {
                        type: 'text',
                        key: 'defaultMainFont',
                        placeholder: 'Liberation Serif'
                    }
                },
                {
                    name: 'PDF mono font',
                    desc: 'Forwarded to pandoc as `-V monofont=…` for code blocks. Examples: Liberation Mono, DejaVu Sans Mono, JetBrainsMono NF.',
                    control: {
                        type: 'text',
                        key: 'defaultMonoFont',
                        placeholder: 'Liberation Mono'
                    }
                },
                {
                    name: 'Typst image width',
                    desc: 'Forwarded as `#set image(width: <value>)` in the Typst preamble — caps every image at this width when the PDF engine is Typst. Common values: `100%` (fit text width — default), `80%`, `15cm`. Leave empty to disable.',
                    control: { type: 'text', key: 'typstImageWidth', placeholder: '100%' }
                },
                {
                    name: 'Page size',
                    desc: 'PDF paper size. `a4`, `us-letter`, `a5`, `legal`, … Translated per engine (Typst `paper:`, LaTeX `papersize`). Leave empty for the engine default. Per-book `book_export.page_size` wins; explicit `pandoc_extra_args` win over both.',
                    control: { type: 'text', key: 'pageSize', placeholder: 'a4' }
                },
                {
                    name: 'Page margin',
                    desc: 'Uniform page margin with a unit, e.g. `2cm`, `1in`. Typst `margin`, LaTeX `geometry`. Leave empty for the engine default. Per-book `book_export.margin` wins.',
                    control: { type: 'text', key: 'pageMargin', placeholder: '2cm' }
                },
                {
                    name: 'Line spacing',
                    desc: 'Line spacing as a unitless multiple, e.g. `1.5`. LaTeX `linestretch` (setspace); Typst `par(leading)` (× the 0.65em default). Leave empty for single spacing. Per-book `book_export.line_spacing` wins.',
                    control: { type: 'text', key: 'lineSpacing', placeholder: '1.5' }
                },
                {
                    name: 'Base font size',
                    desc: 'Base body font size, e.g. `11pt` (a bare number gets `pt` appended). Forwarded as `-V fontsize=…`. Note: standard LaTeX classes only honour 10/11/12pt. Leave empty for the engine default. Per-book `book_export.base_font_size` wins.',
                    control: { type: 'text', key: 'baseFontSize', placeholder: '11pt' }
                },
                {
                    name: 'Include TOC by default',
                    control: { type: 'toggle', key: 'includeTocByDefault' }
                },
                {
                    name: 'Auto TOC depth',
                    desc: 'When enabled (default), the TOC depth is computed from the deepest heading level actually present in the manifest (parts + chapters → depth 3, flat chapters → depth 2). Disable to fall back to the static TOC depth below. Per-book `book_export.toc_depth` always wins.',
                    control: { type: 'toggle', key: 'tocDepthAuto' }
                },
                {
                    name: 'TOC depth (fallback)',
                    desc: 'Used when "Auto TOC depth" is off, or when the manifest has no parseable heading.',
                    control: {
                        type: 'number',
                        key: 'tocDepthDefault',
                        min: 1,
                        step: 1,
                        validate: (value): string | void => {
                            if (!Number.isFinite(value) || value <= 0) {
                                return 'Enter a depth of 1 or more.'
                            }
                        }
                    }
                },
                {
                    name: 'Number sections',
                    desc: 'Forwards `--number-sections` to pandoc — headings get hierarchical numbers (1, 1.1, 1.1.1, ...). Per-book override: `book_export.number_sections`.',
                    control: { type: 'toggle', key: 'numberSections' }
                },
                {
                    name: 'Page break per chapter',
                    desc: 'Insert a page break before each top-level section (the lowest-numbered heading level used in the manifest).',
                    control: { type: 'toggle', key: 'pageBreakPerChapterDefault' }
                }
            ]
        }
    }

    private debugGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            heading: 'Debug',
            items: [
                {
                    name: 'Keep temporary files',
                    desc: 'Useful when an export fails to inspect the compiled manuscript.',
                    control: { type: 'toggle', key: 'keepTempFiles' }
                },
                {
                    name: 'Verbose console logging',
                    control: { type: 'toggle', key: 'debug' }
                }
            ]
        }
    }

    private supportGroup(): SettingDefinitionItem {
        return {
            type: 'group',
            // No heading: renderSupportSection draws its own.
            items: [
                {
                    name: 'Support',
                    searchable: false,
                    render: (setting): void => {
                        setting.settingEl.addClass('book-exporter-settings-embed')
                        setting.infoEl.remove()
                        renderSupportSection(setting.settingEl, (el) => {
                            new Setting(el)
                                .setName('Buy me a coffee')
                                .addButton((b) =>
                                    b
                                        .setButtonText('Donate ☕')
                                        .onClick(() => window.open(BUY_ME_A_COFFEE_URL))
                                )
                        })
                    }
                }
            ]
        }
    }
}

function parseFormats(value: string): ExportFormat[] {
    const parts = value
        .split(/[\s,]+/)
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length > 0)
    const out = parts.filter((p): p is ExportFormat => FORMATS.includes(p as ExportFormat))
    return out.length > 0 ? out : FORMATS
}

function parseList(value: string): string[] {
    return value
        .split(/[\n,]+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
}
