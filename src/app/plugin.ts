import { Notice, Plugin } from 'obsidian'
import { promises as fs } from 'node:fs'
import { produce, type Draft } from 'immer'
import { DEFAULT_SETTINGS, type PluginSettings } from './types/plugin-settings.intf'
import { BookExporterSettingTab } from './settings/settings-tab'
import { registerCommands } from './commands/commands'
import { log, setDebugLogging } from '../utils/log'
import { probeBinary } from '../utils/binary-probe'
import { buildSpawnEnv } from '../utils/spawn-env'
import { PreviewTempDirs } from '../utils/temp-dirs'

export class BookExporterPlugin extends Plugin {
    settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)

    /**
     * Temp dirs produced by the preview command, cleaned on unload and before
     * each new preview so they don't accumulate for the session (issue #6).
     */
    readonly previewTempDirs = new PreviewTempDirs((dir) =>
        fs.rm(dir, { recursive: true, force: true })
    )

    override async onload(): Promise<void> {
        log('Loading Book Exporter', 'debug')
        await this.loadSettings()
        this.addSettingTab(new BookExporterSettingTab(this.app, this))
        registerCommands(this)
        // Pre-flight binary check — surface missing dependencies early so
        // the user fixes them before hitting "Export" and getting a cryptic
        // pandoc / typst error. Fire-and-forget so plugin load is not
        // blocked by the spawn round-trip.
        void this.runPreflightCheck()
    }

    /**
     * Verifies that pandoc (and the configured PDF engine, when it is
     * something we can probe — `typst` ships as a single CLI; LaTeX
     * engines vary too much to probe meaningfully) are reachable on
     * `$PATH`. Surfaces failures via Obsidian `Notice`. Never throws —
     * the export commands themselves still fail loudly if a binary turns
     * out to be missing later (e.g. uninstalled after plugin load).
     */
    private async runPreflightCheck(): Promise<void> {
        const env = buildSpawnEnv(this.settings.extraPath)
        const pandoc = await probeBinary(this.settings.pandocPath, { env })
        if (!pandoc.ok) {
            const where =
                this.settings.pandocPath === 'pandoc'
                    ? 'on $PATH'
                    : `at ${this.settings.pandocPath}`
            new Notice(
                `Book Exporter: pandoc not reachable ${where}. Set Settings → Book Exporter → Pandoc path. (${pandoc.error ?? 'not found'})`,
                10000
            )
            log(`Pandoc probe failed: ${pandoc.error ?? 'unknown'}`, 'warn')
        } else {
            log(`Pandoc OK: ${pandoc.versionLine ?? 'reachable'}`, 'debug')
        }

        // Only probe Typst — the LaTeX engines (xelatex/tectonic/lualatex)
        // are sensitive to environment, $PATH munging on macOS GUI apps,
        // missing TeX Live packages etc. A naive --version probe would
        // produce false negatives; we let pandoc surface those errors at
        // export time.
        if (this.settings.defaultPdfEngine === 'typst') {
            const typstBin =
                this.settings.pdfEnginePath.trim().length > 0
                    ? this.settings.pdfEnginePath.trim()
                    : 'typst'
            const typst = await probeBinary(typstBin, { env })
            if (!typst.ok) {
                const where = typstBin === 'typst' ? 'on $PATH' : `at ${typstBin}`
                new Notice(
                    `Book Exporter: typst not reachable ${where}. PDF export will fail. Install from https://typst.app, set Settings → Book Exporter → PDF engine path, or pick a different engine. (${typst.error ?? 'not found'})`,
                    10000
                )
                log(`Typst probe failed: ${typst.error ?? 'unknown'}`, 'warn')
            } else {
                log(`Typst OK: ${typst.versionLine ?? 'reachable'}`, 'debug')
            }
        }
    }

    override onunload(): void {
        log('Unloading Book Exporter', 'debug')
        // Remove any preview temp dirs left over this session. Fire-and-forget
        // — onunload is synchronous and best-effort cleanup must not block it.
        void this.previewTempDirs.cleanupAll()
    }

    async loadSettings(): Promise<void> {
        const loaded = (await this.loadData()) as Partial<PluginSettings> | null
        this.settings = produce(DEFAULT_SETTINGS, (draft: Draft<PluginSettings>) => {
            if (loaded === null) return
            for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PluginSettings)[]) {
                const value = loaded[key]
                if (value === undefined) continue
                ;(draft as Record<string, unknown>)[key] = value
            }
        })
        setDebugLogging(this.settings.debug)
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings)
    }

    /**
     * Mutate settings via an Immer draft, persist, and return.
     */
    async updateSettings(mutator: (draft: Draft<PluginSettings>) => void): Promise<void> {
        this.settings = produce(this.settings, mutator)
        setDebugLogging(this.settings.debug)
        await this.saveSettings()
    }
}
