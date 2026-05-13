import { App, PluginSettingTab, Setting } from 'obsidian'
import type BookExporterPlugin from '../../main'
import type { ExportFormat, InlinedNoteSeparator, PdfEngine } from '../domain/book-manifest.intf'

const PDF_ENGINES: PdfEngine[] = ['typst', 'weasyprint', 'xelatex', 'tectonic', 'wkhtmltopdf']
const FORMATS: ExportFormat[] = ['epub', 'pdf']
const NOTE_SEPARATORS: { value: InlinedNoteSeparator; label: string }[] = [
    { value: 'none', label: 'None — notes flow into one another (legacy)' },
    { value: 'rule', label: 'Glyph rule (* * *)' },
    { value: 'blank', label: 'Blank line' },
    { value: 'subheading', label: 'Note title as sub-heading' }
]

export class BookExporterSettingTab extends PluginSettingTab {
    plugin: BookExporterPlugin

    constructor(app: App, plugin: BookExporterPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    override display(): void {
        const { containerEl } = this
        containerEl.empty()

        this.renderTools(containerEl)
        this.renderOutput(containerEl)
        this.renderProcessing(containerEl)
        this.renderRendering(containerEl)
        this.renderDebug(containerEl)
        this.renderSupport(containerEl)
    }

    private renderTools(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('External tools').setHeading()

        new Setting(containerEl)
            .setName('Pandoc path')
            .setDesc('Required. Full path to the pandoc binary, or just `pandoc` to rely on $PATH.')
            .addText((t) =>
                t
                    .setPlaceholder('pandoc')
                    .setValue(this.plugin.settings.pandocPath)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.pandocPath = value.trim() || 'pandoc'
                        })
                    })
            )
    }

    private renderOutput(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Output').setHeading()

        new Setting(containerEl)
            .setName('Default output folder')
            .setDesc(
                'Required. Absolute filesystem path where exported books are written. `~` is expanded to your home directory. The plugin refuses to export until this is set. Example: ~/Downloads or /home/me/Books.'
            )
            .addText((t) =>
                t
                    .setPlaceholder('~/Downloads')
                    .setValue(this.plugin.settings.defaultOutputDir)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.defaultOutputDir = value.trim()
                        })
                    })
            )

        new Setting(containerEl)
            .setName('Default formats')
            .setDesc(
                'Comma-separated list. Used by "Export to all formats" when the manifest doesn\'t specify any.'
            )
            .addText((t) =>
                t
                    .setPlaceholder('epub,pdf')
                    .setValue(this.plugin.settings.defaultFormats.join(','))
                    .onChange(async (value) => {
                        const formats = parseFormats(value)
                        await this.plugin.updateSettings((draft) => {
                            draft.defaultFormats = formats
                        })
                    })
            )

        new Setting(containerEl)
            .setName('PDF engine')
            .setDesc(
                'Pandoc PDF engine used unless the book overrides it. Typst is recommended — single small binary, no LaTeX install needed.'
            )
            .addDropdown((d) => {
                for (const engine of PDF_ENGINES) d.addOption(engine, engine)
                d.setValue(this.plugin.settings.defaultPdfEngine).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.defaultPdfEngine = value as PdfEngine
                    })
                })
            })

        new Setting(containerEl)
            .setName('Default language')
            .setDesc("BCP-47 code (en, fr, ...) used when the manifest doesn't set one.")
            .addText((t) =>
                t.setValue(this.plugin.settings.defaultLanguage).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.defaultLanguage = value.trim() || 'en'
                    })
                })
            )

        new Setting(containerEl)
            .setName('Default author(s)')
            .setDesc(
                'Comma-separated list. Used when the manifest doesn\'t define `authors:` in its frontmatter. Leave empty to fall back to "Anonymous".'
            )
            .addText((t) =>
                t
                    .setPlaceholder('Sébastien Dubois')
                    .setValue(this.plugin.settings.defaultAuthors.join(', '))
                    .onChange(async (value) => {
                        const authors = parseList(value)
                        await this.plugin.updateSettings((draft) => {
                            draft.defaultAuthors = authors
                        })
                    })
            )
    }

    private renderProcessing(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Note processing').setHeading()

        new Setting(containerEl)
            .setName('Cover frontmatter property')
            .setDesc(
                'Frontmatter key read for the book cover. Value can be a vault-relative path, an absolute path, an [[wikilink]], or an http(s) URL (downloaded to the temp folder before pandoc runs). Default: cover.'
            )
            .addText((t) =>
                t
                    .setPlaceholder('cover')
                    .setValue(this.plugin.settings.coverProperty)
                    .onChange(async (value) => {
                        const trimmed = value.trim()
                        await this.plugin.updateSettings((draft) => {
                            draft.coverProperty = trimmed.length > 0 ? trimmed : 'cover'
                        })
                    })
            )

        new Setting(containerEl)
            .setName('Inline note embeds')
            .setDesc(
                "When on, `![[Note]]` embeds inside inlined notes are recursively expanded with the embedded note's body. Default off — embeds are dropped (only image embeds are kept). Cycle detection and the depth limit below keep recursion safe."
            )
            .addToggle((t) =>
                t.setValue(this.plugin.settings.inlineNoteEmbeds).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.inlineNoteEmbeds = value
                    })
                })
            )
        new Setting(containerEl)
            .setName('Note embed max depth')
            .setDesc(
                'Maximum recursion depth for note-embed expansion. 1 = direct embeds only; 2 = embeds of embeds; etc. Embeds at the depth limit are replaced with their display title.'
            )
            .addText((t) =>
                t
                    .setValue(String(this.plugin.settings.noteEmbedMaxDepth))
                    .onChange(async (value) => {
                        const n = Number(value)
                        if (Number.isFinite(n) && n >= 1) {
                            await this.plugin.updateSettings((draft) => {
                                draft.noteEmbedMaxDepth = Math.floor(n)
                            })
                        }
                    })
            )

        new Setting(containerEl)
            .setName('Inlined-note separator')
            .setDesc(
                'How successive notes inside the same manifest section are separated visually. "None" keeps the legacy run-on behaviour; "Glyph rule" emits a centred `* * *` between notes; "Blank line" adds extra spacing; "Note title as sub-heading" renders each note\'s display title as a heading one level below the section heading. Per-book override: `book_export.inlined_note_separator`.'
            )
            .addDropdown((d) => {
                for (const { value, label } of NOTE_SEPARATORS) d.addOption(value, label)
                d.setValue(this.plugin.settings.inlinedNoteSeparator).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.inlinedNoteSeparator = value as InlinedNoteSeparator
                    })
                })
            })

        new Setting(containerEl)
            .setName('Sections to skip')
            .setDesc(
                'Comma-separated list of heading names (case-insensitive) to skip. Applied to the manifest before parsing (drops authoring scaffolding like "Title Options", "Target Audience") and to each linked note when inlining (drops housekeeping sections like "Related", "References").'
            )
            .addTextArea((t) => {
                t.inputEl.rows = 3
                t.inputEl.cols = 40
                t.setPlaceholder('Related, References, Title Options, Target Audience')
                    .setValue(this.plugin.settings.sectionsToSkip.join(', '))
                    .onChange(async (value) => {
                        const list = parseList(value)
                        await this.plugin.updateSettings((draft) => {
                            draft.sectionsToSkip = list
                        })
                    })
            })
    }

    private renderRendering(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Rendering').setHeading()

        new Setting(containerEl)
            .setName('PDF main font')
            .setDesc(
                'Forwarded to pandoc as `-V mainfont=…` for PDF exports. Required by Pandoc 3.6+ Typst (an empty font causes "font fallback list must not be empty"). Use a font reported by `typst fonts` on this machine — e.g. Liberation Serif, New Computer Modern, Noto Serif. Overridable per book via `pandoc_extra_args`.'
            )
            .addText((t) =>
                t
                    .setPlaceholder('Liberation Serif')
                    .setValue(this.plugin.settings.defaultMainFont)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.defaultMainFont = value.trim()
                        })
                    })
            )

        new Setting(containerEl)
            .setName('PDF mono font')
            .setDesc(
                'Forwarded to pandoc as `-V monofont=…` for code blocks. Examples: Liberation Mono, DejaVu Sans Mono, JetBrainsMono NF.'
            )
            .addText((t) =>
                t
                    .setPlaceholder('Liberation Mono')
                    .setValue(this.plugin.settings.defaultMonoFont)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.defaultMonoFont = value.trim()
                        })
                    })
            )

        new Setting(containerEl)
            .setName('Typst image width')
            .setDesc(
                'Forwarded as `#set image(width: <value>)` in the Typst preamble — caps every image at this width when the PDF engine is Typst. Common values: `100%` (fit text width — default), `80%`, `15cm`. Leave empty to disable.'
            )
            .addText((t) =>
                t
                    .setPlaceholder('100%')
                    .setValue(this.plugin.settings.typstImageWidth)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.typstImageWidth = value.trim()
                        })
                    })
            )

        new Setting(containerEl).setName('Include TOC by default').addToggle((t) =>
            t.setValue(this.plugin.settings.includeTocByDefault).onChange(async (value) => {
                await this.plugin.updateSettings((draft) => {
                    draft.includeTocByDefault = value
                })
            })
        )
        new Setting(containerEl)
            .setName('Auto TOC depth')
            .setDesc(
                'When enabled (default), the TOC depth is computed from the deepest heading level actually present in the manifest (parts + chapters → depth 3, flat chapters → depth 2). Disable to fall back to the static TOC depth below. Per-book `book_export.toc_depth` always wins.'
            )
            .addToggle((t) =>
                t.setValue(this.plugin.settings.tocDepthAuto).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.tocDepthAuto = value
                    })
                })
            )
        new Setting(containerEl)
            .setName('TOC depth (fallback)')
            .setDesc(
                'Used when "Auto TOC depth" is off, or when the manifest has no parseable heading.'
            )
            .addText((t) =>
                t.setValue(String(this.plugin.settings.tocDepthDefault)).onChange(async (value) => {
                    const n = Number(value)
                    if (Number.isFinite(n) && n > 0) {
                        await this.plugin.updateSettings((draft) => {
                            draft.tocDepthDefault = Math.floor(n)
                        })
                    }
                })
            )
        new Setting(containerEl)
            .setName('Number sections')
            .setDesc(
                'Forwards `--number-sections` to pandoc — headings get hierarchical numbers (1, 1.1, 1.1.1, ...). Per-book override: `book_export.number_sections`.'
            )
            .addToggle((t) =>
                t.setValue(this.plugin.settings.numberSections).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.numberSections = value
                    })
                })
            )

        new Setting(containerEl)
            .setName('Page break per chapter')
            .setDesc(
                'Insert a page break before each top-level section (the lowest-numbered heading level used in the manifest).'
            )
            .addToggle((t) =>
                t
                    .setValue(this.plugin.settings.pageBreakPerChapterDefault)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.pageBreakPerChapterDefault = value
                        })
                    })
            )
    }

    private renderDebug(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Debug').setHeading()
        new Setting(containerEl)
            .setName('Keep temporary files')
            .setDesc('Useful when an export fails to inspect the compiled manuscript.')
            .addToggle((t) =>
                t.setValue(this.plugin.settings.keepTempFiles).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.keepTempFiles = value
                    })
                })
            )
        new Setting(containerEl).setName('Verbose console logging').addToggle((t) =>
            t.setValue(this.plugin.settings.debug).onChange(async (value) => {
                await this.plugin.updateSettings((draft) => {
                    draft.debug = value
                })
            })
        )
    }

    private renderSupport(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Support').setHeading()
        new Setting(containerEl).setName('Follow Sébastien on X').addButton((b) =>
            b
                .setCta()
                .setButtonText('@dSebastien')
                .onClick(() => window.open('https://x.com/dSebastien'))
        )
        new Setting(containerEl)
            .setName('Buy me a coffee')
            .addButton((b) =>
                b
                    .setButtonText('☕ Donate')
                    .onClick(() => window.open('https://www.buymeacoffee.com/dsebastien'))
            )
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
