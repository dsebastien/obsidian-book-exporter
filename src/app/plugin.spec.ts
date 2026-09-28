import { describe, expect, test } from 'bun:test'
import { produce } from 'immer'
import type { App, PluginManifest } from 'obsidian'
import { BookExporterPlugin } from './plugin'
import { DEFAULT_SETTINGS, createDefaultSettings } from './types/plugin-settings.intf'

function expectDefaultsNotFrozen(): void {
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(false)
    expect(Object.isFrozen(DEFAULT_SETTINGS.defaultAuthors)).toBe(false)
    expect(Object.isFrozen(DEFAULT_SETTINGS.sectionsToSkip)).toBe(false)
    expect(Object.isFrozen(DEFAULT_SETTINGS.defaultFormats)).toBe(false)
}

function pluginWithStoredData(data: unknown): BookExporterPlugin {
    // Skip the constructor: its field initializer is the first test's case.
    return Object.assign(Object.create(BookExporterPlugin.prototype) as BookExporterPlugin, {
        settings: produce(createDefaultSettings(), () => {}),
        loadData: (): Promise<unknown> => Promise.resolve(data)
    })
}

describe('default settings', () => {
    test('constructing the plugin never freezes the shared defaults', () => {
        const plugin = new BookExporterPlugin({} as App, {} as PluginManifest)
        expect(Object.isFrozen(plugin.settings)).toBe(true)
        expectDefaultsNotFrozen()
    })

    test('loadSettings with no stored data never freezes the shared defaults', async () => {
        const plugin = pluginWithStoredData(null)

        await plugin.loadSettings()

        // Immer deep-freezes what produce returns, including subtrees shared
        // with its base: producing from DEFAULT_SETTINGS froze the constant
        // for the rest of the process.
        expect(plugin.settings).toEqual(DEFAULT_SETTINGS)
        expect(Object.isFrozen(plugin.settings)).toBe(true)
        expectDefaultsNotFrozen()
    })

    test('loadSettings falls back to the defaults when loadData resolves undefined', async () => {
        // The first key lookup threw on undefined; only null was guarded.
        const plugin = pluginWithStoredData(undefined)

        await plugin.loadSettings()

        expect(plugin.settings).toEqual(DEFAULT_SETTINGS)
        expectDefaultsNotFrozen()
    })

    test('loadSettings with stored data never freezes the defaults it keeps', async () => {
        // Only pandocPath is stored: the arrays still come from the base.
        const plugin = pluginWithStoredData({ pandocPath: '/usr/bin/pandoc' })

        await plugin.loadSettings()

        expect(plugin.settings.pandocPath).toBe('/usr/bin/pandoc')
        expect(plugin.settings.sectionsToSkip).toEqual(DEFAULT_SETTINGS.sectionsToSkip)
        expectDefaultsNotFrozen()
    })

    test('each default settings object is an independent copy', () => {
        const one = createDefaultSettings()
        one.defaultAuthors.push('Someone')
        one.sectionsToSkip.push('Extra')
        one.defaultFormats.push('pdf')
        const two = createDefaultSettings()
        expect(two.defaultAuthors).toEqual([])
        expect(two.sectionsToSkip).not.toContain('Extra')
        expect(two.defaultFormats).toEqual(['epub', 'pdf'])
        expect(DEFAULT_SETTINGS.defaultAuthors).toEqual([])
    })
})
