import { App, PluginSettingTab, Setting } from 'obsidian'
import type BookExporterPlugin from '../../main'
import type { ExportFormat, PdfEngine } from '../domain/book-manifest.intf'

const PDF_ENGINES: PdfEngine[] = ['typst', 'weasyprint', 'xelatex', 'tectonic', 'wkhtmltopdf']
const FORMATS: ExportFormat[] = ['epub', 'pdf']

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
            .setDesc('BCP-47 code (en, fr, ...) used when the manifest doesn\'t set one.')
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
        new Setting(containerEl).setName('Include TOC by default').addToggle((t) =>
            t.setValue(this.plugin.settings.includeTocByDefault).onChange(async (value) => {
                await this.plugin.updateSettings((draft) => {
                    draft.includeTocByDefault = value
                })
            })
        )
        new Setting(containerEl).setName('TOC depth').addText((t) =>
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
        new Setting(containerEl).setName('Buy me a coffee').addButton((b) =>
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
