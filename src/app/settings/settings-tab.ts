import { App, PluginSettingTab, Setting } from 'obsidian'
import type BookExporterPlugin from '../../main'
import type { ExportFormat, PdfEngine } from '../domain/book-manifest.intf'

const PDF_ENGINES: PdfEngine[] = ['xelatex', 'weasyprint', 'wkhtmltopdf', 'tectonic', 'typst']
const FORMATS: ExportFormat[] = ['epub', 'pdf', 'mobi']

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
        this.renderHeadings(containerEl)
        this.renderRendering(containerEl)
        this.renderDebug(containerEl)
        this.renderSupport(containerEl)
    }

    private renderTools(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('External tools').setHeading()

        new Setting(containerEl)
            .setName('Pandoc path')
            .setDesc('Full path to the pandoc binary, or just `pandoc` to rely on $PATH.')
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

        new Setting(containerEl)
            .setName('Calibre `ebook-convert` path')
            .setDesc('Required for MOBI export. Defaults to `ebook-convert` on $PATH.')
            .addText((t) =>
                t
                    .setPlaceholder('ebook-convert')
                    .setValue(this.plugin.settings.ebookConvertPath)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.ebookConvertPath = value.trim() || 'ebook-convert'
                        })
                    })
            )
    }

    private renderOutput(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Output').setHeading()

        new Setting(containerEl)
            .setName('Default output folder')
            .setDesc('Vault-relative folder for exported files.')
            .addText((t) =>
                t
                    .setPlaceholder('Exports/Books')
                    .setValue(this.plugin.settings.defaultOutputDir)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.defaultOutputDir = value.trim() || 'Exports/Books'
                        })
                    })
            )

        new Setting(containerEl)
            .setName('Default formats')
            .setDesc(
                'Comma-separated list. Used by "Export to all formats" when the book note doesn\'t specify any.'
            )
            .addText((t) =>
                t
                    .setPlaceholder('epub,pdf,mobi')
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
            .setDesc('Pandoc PDF engine used unless the book overrides it.')
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
            .setDesc('BCP-47 code (en, fr, ...) used when the book note doesn\'t set one.')
            .addText((t) =>
                t.setValue(this.plugin.settings.defaultLanguage).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.defaultLanguage = value.trim() || 'en'
                    })
                })
            )
    }

    private renderHeadings(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Body headings').setHeading()
        new Setting(containerEl).setName('Front-matter heading').addText((t) =>
            t.setValue(this.plugin.settings.frontMatterHeading).onChange(async (value) => {
                await this.plugin.updateSettings((draft) => {
                    draft.frontMatterHeading = value.trim() || 'Front Matter'
                })
            })
        )
        new Setting(containerEl).setName('Chapters heading').addText((t) =>
            t.setValue(this.plugin.settings.chaptersHeading).onChange(async (value) => {
                await this.plugin.updateSettings((draft) => {
                    draft.chaptersHeading = value.trim() || 'Chapters'
                })
            })
        )
        new Setting(containerEl).setName('Back-matter heading').addText((t) =>
            t.setValue(this.plugin.settings.backMatterHeading).onChange(async (value) => {
                await this.plugin.updateSettings((draft) => {
                    draft.backMatterHeading = value.trim() || 'Back Matter'
                })
            })
        )
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
        new Setting(containerEl).setName('Page break per chapter').addToggle((t) =>
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
