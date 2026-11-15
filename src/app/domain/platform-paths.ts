import type { PluginSettings } from '../types/plugin-settings.intf'

/**
 * Per-system values for the settings that hold filesystem paths.
 *
 * `data.json` syncs between devices, so one shared value cannot fit a vault
 * opened on Windows and on Linux: `C:\…\pandoc.exe` breaks on Linux, `/usr/bin/…`
 * breaks on Windows, and the `extraPath` separator differs (`;` vs `:`). Each
 * system gets its own value; an empty value falls back to the shared one.
 */
export type HostPlatform = 'windows' | 'linux' | 'macos'

export const HOST_PLATFORMS: readonly HostPlatform[] = ['windows', 'linux', 'macos']

export const PLATFORM_LABELS: Record<HostPlatform, string> = {
    windows: 'Windows',
    linux: 'Linux',
    macos: 'macOS'
}

/** The settings that hold a path and therefore get one value per system. */
export const PLATFORM_PATH_KEYS = [
    'pandocPath',
    'pdfEnginePath',
    'extraPath',
    'defaultOutputDir'
] as const

export type PlatformPathKey = (typeof PLATFORM_PATH_KEYS)[number]

/** One system's values. An empty string means "use the shared value". */
export type PlatformPathValues = Record<PlatformPathKey, string>

export type PlatformPaths = Record<HostPlatform, PlatformPathValues>

export function createEmptyPlatformPathValues(): PlatformPathValues {
    return { pandocPath: '', pdfEnginePath: '', extraPath: '', defaultOutputDir: '' }
}

/** Deep-fresh, safe to hand to Immer (see createDefaultSettings). */
export function createEmptyPlatformPaths(): PlatformPaths {
    return {
        windows: createEmptyPlatformPathValues(),
        linux: createEmptyPlatformPathValues(),
        macos: createEmptyPlatformPathValues()
    }
}

export function isPlatformPathKey(key: string): key is PlatformPathKey {
    return (PLATFORM_PATH_KEYS as readonly string[]).includes(key)
}

export function isHostPlatform(value: string): value is HostPlatform {
    return (HOST_PLATFORMS as readonly string[]).includes(value)
}

/**
 * Builds a complete `PlatformPaths` from whatever `data.json` holds: a missing
 * system, a missing field or a non-string value becomes an empty string, and
 * unknown keys are dropped. Never throws.
 */
export function normalizePlatformPaths(raw: unknown): PlatformPaths {
    const result = createEmptyPlatformPaths()
    if (typeof raw !== 'object' || raw === null) return result
    const source = raw as Record<string, unknown>
    for (const platform of HOST_PLATFORMS) {
        const entry = source[platform]
        if (typeof entry !== 'object' || entry === null) continue
        const values = entry as Record<string, unknown>
        for (const key of PLATFORM_PATH_KEYS) {
            const value = values[key]
            if (typeof value === 'string') result[platform][key] = value.trim()
        }
    }
    return result
}

/** The subset of Obsidian's `Platform` this module reads. */
export interface PlatformFlags {
    isWin: boolean
    isMacOS: boolean
    isLinux: boolean
}

/** `null` when the system is none of the three (shared values apply). */
export function detectHostPlatform(flags: PlatformFlags | undefined): HostPlatform | null {
    if (!flags) return null
    if (flags.isWin) return 'windows'
    if (flags.isMacOS) return 'macos'
    if (flags.isLinux) return 'linux'
    return null
}

/**
 * The settings as the current system sees them: each path setting takes the
 * system's own value when it is set, else the shared value. Returns the same
 * object when nothing is overridden.
 */
export function resolvePlatformSettings(
    settings: PluginSettings,
    platform: HostPlatform | null
): PluginSettings {
    if (!platform) return settings
    const own = settings.platformPaths[platform]
    const overrides: Partial<PlatformPathValues> = {}
    for (const key of PLATFORM_PATH_KEYS) {
        const value = own[key].trim()
        if (value.length > 0) overrides[key] = value
    }
    if (Object.keys(overrides).length === 0) return settings
    return { ...settings, ...overrides }
}
