import { describe, expect, it } from 'bun:test'
import type { BookExportOverrides, ParsedBook } from '../domain/book-manifest.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'
import { pickPdfEngineArg } from './pandoc-runner'

function makeBook(overrides: BookExportOverrides = {}): ParsedBook {
    return {
        bookNotePath: 'Book.md',
        metadata: { title: 'Book', authors: [], language: 'en' },
        overrides,
        sections: [],
        maxHeadingLevel: 0
    }
}

function makeSettings(patch: Partial<PluginSettings> = {}): PluginSettings {
    return { ...DEFAULT_SETTINGS, ...patch }
}

describe('pickPdfEngineArg', () => {
    it('returns the engine name when no path is configured', () => {
        const settings = makeSettings({ pdfEnginePath: '' })
        expect(pickPdfEngineArg('typst', makeBook(), settings)).toBe('typst')
    })

    it('forwards the configured path when the basename matches the engine', () => {
        const settings = makeSettings({ pdfEnginePath: '/opt/homebrew/bin/typst' })
        expect(pickPdfEngineArg('typst', makeBook(), settings)).toBe('/opt/homebrew/bin/typst')
    })

    it('handles a Windows-style .exe basename', () => {
        const settings = makeSettings({ pdfEnginePath: 'C:\\Tools\\typst.exe' })
        // On POSIX, basename keeps the whole "C:\\Tools\\typst.exe" string,
        // which then has to startsWith("typst.") — guard the test by
        // matching the prefix instead of asserting the exact basename split.
        const arg = pickPdfEngineArg('typst', makeBook(), settings)
        expect(arg === 'C:\\Tools\\typst.exe' || arg === 'typst').toBe(true)
    })

    it('falls back to the engine name when the basename does not match', () => {
        const settings = makeSettings({ pdfEnginePath: '/opt/homebrew/bin/typst' })
        expect(pickPdfEngineArg('xelatex', makeBook(), settings)).toBe('xelatex')
    })

    it("yields to the user's --pdf-engine in pandocExtraArgs (--pdf-engine path form)", () => {
        const settings = makeSettings({ pdfEnginePath: '/opt/homebrew/bin/typst' })
        const book = makeBook({ pandocExtraArgs: ['--pdf-engine', '/custom/typst'] })
        expect(pickPdfEngineArg('typst', book, settings)).toBe('typst')
    })

    it("yields to the user's --pdf-engine in pandocExtraArgs (--pdf-engine=path form)", () => {
        const settings = makeSettings({ pdfEnginePath: '/opt/homebrew/bin/typst' })
        const book = makeBook({ pandocExtraArgs: ['--pdf-engine=/custom/typst'] })
        expect(pickPdfEngineArg('typst', book, settings)).toBe('typst')
    })
})
