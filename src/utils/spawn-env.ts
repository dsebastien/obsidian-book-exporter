import * as path from 'node:path'
import { existsSync } from 'node:fs'

/** Plain `string`-valued env map — matches the shape `child_process.spawn` accepts via `env`. */
export type SpawnEnv = Record<string, string | undefined>

/**
 * Well-known locations where `pandoc` / `typst` / LaTeX engines are installed
 * but which a GUI-launched Obsidian does not have on `PATH` (see
 * {@link buildSpawnEnv}). Appended (when they exist) so the user rarely has to
 * configure `extraPath` by hand. POSIX paths only — on Windows none exist, so
 * the existence check skips them all.
 */
export const WELL_KNOWN_BIN_DIRS = [
    '/opt/homebrew/bin', // Homebrew (Apple Silicon)
    '/usr/local/bin', // Homebrew (Intel) / common manual installs
    '/opt/local/bin', // MacPorts
    '/Library/TeX/texbin', // MacTeX / BasicTeX
    '/usr/bin',
    '/bin'
]

/**
 * Builds the env passed to spawned child processes so they can resolve
 * binaries the user has on PATH in a terminal but that Obsidian — an Electron
 * GUI app — does not inherit on macOS.
 *
 * Obsidian launched from Finder / the dock on macOS starts with a stripped
 * PATH (typically `/usr/bin:/bin:/usr/sbin:/sbin`), so calls to `pandoc` /
 * `typst` / `xelatex` installed under `/opt/homebrew/bin`, `/usr/local/bin`
 * or `/Library/TeX/texbin` fail with "not found" even though the same commands
 * work in Terminal.
 *
 * To fix this without the user having to configure anything, the resulting
 * PATH is the de-duplicated concatenation of, in priority order:
 *   1. the user-provided `extraPath` (highest priority — their explicit choice);
 *   2. the inherited `PATH` (so anything Obsidian *did* have still wins over
 *      auto-detected fallbacks);
 *   3. the {@link WELL_KNOWN_BIN_DIRS} that actually exist on disk.
 *
 * Returns `process.env` unchanged when this produces no change to PATH, so
 * callers pay no cost in the common case. `dirExists` is injectable for tests.
 */
export function buildSpawnEnv(
    extraPath: string,
    dirExists: (dir: string) => boolean = existsSync
): SpawnEnv {
    const sep = path.delimiter
    const split = (value: string): string[] =>
        value
            .split(sep)
            .map((p) => p.trim())
            .filter((p) => p.length > 0)

    const current = process.env['PATH'] ?? ''
    const have = new Set(split(current))

    // Dedupe additions against the existing PATH and against each other, but
    // leave the inherited PATH string itself untouched — so when nothing new
    // is added we can return process.env verbatim.
    const take = (candidates: string[]): string[] => {
        const out: string[] = []
        for (const dir of candidates) {
            if (have.has(dir)) continue
            have.add(dir)
            out.push(dir)
        }
        return out
    }

    const userExtras = take(split(extraPath))
    const autoExtras = take(WELL_KNOWN_BIN_DIRS.filter((dir) => dirExists(dir)))

    if (userExtras.length === 0 && autoExtras.length === 0) return process.env

    const newPath = [...userExtras, current, ...autoExtras].filter((p) => p.length > 0).join(sep)

    const env: SpawnEnv = { ...process.env }
    env['PATH'] = newPath
    return env
}
