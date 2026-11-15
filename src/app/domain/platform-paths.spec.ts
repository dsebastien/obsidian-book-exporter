import { describe, expect, test } from 'bun:test'
import { createDefaultSettings } from '../types/plugin-settings.intf'
import {
    PLATFORM_PATH_KEYS,
    createEmptyPlatformPaths,
    detectHostPlatform,
    normalizePlatformPaths,
    resolvePlatformSettings
} from './platform-paths'
import { parsePlatformKey, platformKey } from '../settings/settings-tab'

describe('detectHostPlatform', () => {
    test('maps the Obsidian Platform flags to a system', () => {
        expect(detectHostPlatform({ isWin: true, isMacOS: false, isLinux: false })).toBe('windows')
        expect(detectHostPlatform({ isWin: false, isMacOS: true, isLinux: false })).toBe('macos')
        expect(detectHostPlatform({ isWin: false, isMacOS: false, isLinux: true })).toBe('linux')
    })

    test('returns null for an unknown system or missing flags', () => {
        expect(detectHostPlatform({ isWin: false, isMacOS: false, isLinux: false })).toBeNull()
        expect(detectHostPlatform(undefined)).toBeNull()
    })
})

describe('normalizePlatformPaths', () => {
    test('anything that is not an object gives empty values for every system', () => {
        for (const raw of [undefined, null, 'x', 42, []]) {
            expect(normalizePlatformPaths(raw)).toEqual(createEmptyPlatformPaths())
        }
    })

    test('keeps strings (trimmed), drops other types and unknown keys', () => {
        const result = normalizePlatformPaths({
            windows: { pandocPath: '  C:/Pandoc/pandoc.exe ', extraPath: 7, bogus: 'x' },
            linux: 'not an object',
            plan9: { pandocPath: '/bin/pandoc' }
        })
        expect(result.windows).toEqual({
            pandocPath: 'C:/Pandoc/pandoc.exe',
            pdfEnginePath: '',
            extraPath: '',
            defaultOutputDir: ''
        })
        expect(result.linux).toEqual(createEmptyPlatformPaths().linux)
        expect(Object.keys(result)).toEqual(['windows', 'linux', 'macos'])
    })
})

describe('resolvePlatformSettings', () => {
    function settingsWith(): ReturnType<typeof createDefaultSettings> {
        const s = createDefaultSettings()
        s.pandocPath = 'pandoc'
        s.pdfEnginePath = '/usr/bin/typst'
        s.extraPath = '/opt/bin'
        s.defaultOutputDir = '~/Books'
        return s
    }

    test('the value of the system wins over the shared value, field by field', () => {
        const s = settingsWith()
        s.platformPaths.windows.pandocPath = 'C:/Pandoc/pandoc.exe'
        s.platformPaths.windows.defaultOutputDir = 'D:/Books'
        s.platformPaths.linux.pandocPath = '/should/not/apply'

        const resolved = resolvePlatformSettings(s, 'windows')

        expect(resolved.pandocPath).toBe('C:/Pandoc/pandoc.exe')
        expect(resolved.defaultOutputDir).toBe('D:/Books')
        // Not set for Windows: shared value.
        expect(resolved.pdfEnginePath).toBe('/usr/bin/typst')
        expect(resolved.extraPath).toBe('/opt/bin')
    })

    test('an empty or blank value falls back to the shared value', () => {
        const s = settingsWith()
        s.platformPaths.linux.pandocPath = '   '
        const resolved = resolvePlatformSettings(s, 'linux')
        expect(resolved.pandocPath).toBe('pandoc')
    })

    test('returns the same object when nothing is overridden or the system is unknown', () => {
        const s = settingsWith()
        expect(resolvePlatformSettings(s, 'macos')).toBe(s)
        s.platformPaths.macos.extraPath = '/opt/homebrew/bin'
        expect(resolvePlatformSettings(s, null)).toBe(s)
    })

    test('never mutates the settings it reads', () => {
        const s = settingsWith()
        s.platformPaths.windows.pandocPath = 'C:/Pandoc/pandoc.exe'
        resolvePlatformSettings(s, 'windows')
        expect(s.pandocPath).toBe('pandoc')
    })

    test('covers every path setting', () => {
        const s = settingsWith()
        for (const key of PLATFORM_PATH_KEYS) s.platformPaths.linux[key] = `linux-${key}`
        const resolved = resolvePlatformSettings(s, 'linux')
        for (const key of PLATFORM_PATH_KEYS) expect(resolved[key]).toBe(`linux-${key}`)
    })
})

describe('settings control keys for per-system paths', () => {
    test('round-trip', () => {
        expect(parsePlatformKey(platformKey('windows', 'extraPath'))).toEqual({
            platform: 'windows',
            field: 'extraPath'
        })
    })

    test('refuse unknown systems, fields and shapes', () => {
        expect(parsePlatformKey('pandocPath')).toBeNull()
        expect(parsePlatformKey('platform.plan9.pandocPath')).toBeNull()
        expect(parsePlatformKey('platform.linux.debug')).toBeNull()
        expect(parsePlatformKey('platform.linux.pandocPath.extra')).toBeNull()
        expect(parsePlatformKey('platform.linux')).toBeNull()
    })
})
