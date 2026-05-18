import * as path from 'node:path'

/** Plain `string`-valued env map — matches the shape `child_process.spawn` accepts via `env`. */
export type SpawnEnv = Record<string, string | undefined>

/**
 * Builds the env passed to spawned child processes so they can resolve
 * binaries the user has on PATH in a terminal but that Obsidian — an
 * Electron GUI app — does not inherit on macOS.
 *
 * Obsidian launched from Finder / the dock on macOS starts with a
 * stripped PATH (typically `/usr/bin:/bin:/usr/sbin:/sbin`), so calls to
 * `pandoc` / `typst` / `xelatex` installed under `/opt/homebrew/bin`,
 * `/usr/local/bin` or `/Library/TeX/texbin` fail with "not found" even
 * though the same commands work in Terminal. Prepending the user-provided
 * `extraPath` (e.g. `/opt/homebrew/bin:/Library/TeX/texbin`) restores
 * those locations for the lifetime of the spawned process without
 * touching the global env.
 *
 * Returns `process.env` unchanged when `extraPath` is empty, so callers
 * pay no cost in the common case.
 */
export function buildSpawnEnv(extraPath: string): SpawnEnv {
    const trimmed = extraPath.trim()
    if (trimmed.length === 0) return process.env

    const sep = path.delimiter
    const extras = trimmed
        .split(sep)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    if (extras.length === 0) return process.env

    const env: SpawnEnv = { ...process.env }
    const current = env['PATH'] ?? ''
    env['PATH'] = current.length > 0 ? `${extras.join(sep)}${sep}${current}` : extras.join(sep)
    return env
}
