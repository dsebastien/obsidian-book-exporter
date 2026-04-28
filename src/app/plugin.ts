import { Plugin } from 'obsidian'
import { produce, type Draft } from 'immer'
import { DEFAULT_SETTINGS, type PluginSettings } from './types/plugin-settings.intf'
import { BookExporterSettingTab } from './settings/settings-tab'
import { registerCommands } from './commands/commands'
import { log } from '../utils/log'

export class BookExporterPlugin extends Plugin {
    settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)

    override async onload(): Promise<void> {
        log('Loading Book Exporter', 'debug')
        await this.loadSettings()
        this.addSettingTab(new BookExporterSettingTab(this.app, this))
        registerCommands(this)
    }

    override onunload(): void {
        log('Unloading Book Exporter', 'debug')
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
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings)
    }

    /**
     * Mutate settings via an Immer draft, persist, and return.
     */
    async updateSettings(mutator: (draft: Draft<PluginSettings>) => void): Promise<void> {
        this.settings = produce(this.settings, mutator)
        await this.saveSettings()
    }
}
