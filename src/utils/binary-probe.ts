import { spawn } from 'node:child_process'
import * as path from 'node:path'
import type { SpawnEnv } from './spawn-env'

/**
 * Resolves the binary to probe / invoke for a PDF engine. When the user has
 * pinned a `pdfEnginePath` whose basename matches the selected engine (so a
 * typst path isn't forwarded to a weasyprint export), that full path is used;
 * otherwise the bare engine name is returned and resolved via `$PATH`. Mirrors
 * the resolution `pickPdfEngineArg` applies when building the pandoc argv.
 */
export function resolveEngineBinary(engine: string, pdfEnginePath: string): string {
    const configured = pdfEnginePath.trim()
    if (configured.length === 0) return engine
    const base = path.basename(configured).toLowerCase()
    const e = engine.toLowerCase()
    return base === e || base.startsWith(`${e}.`) ? configured : engine
}

/** Per-engine install hint shown when a PDF engine isn't reachable on load. */
export const ENGINE_INSTALL_HINT: Record<string, string> = {
    typst: 'install from https://typst.app',
    weasyprint: 'install with `pip install weasyprint`',
    xelatex: 'install a TeX distribution (TeX Live / MacTeX)',
    tectonic: 'install from https://tectonic-typesetting.github.io'
}

export interface BinaryProbeResult {
    ok: boolean
    /** First line of stdout when the probe succeeded. */
    versionLine?: string
    /** Human-readable error message when the probe failed. */
    error?: string
}

export interface BinaryProbeOptions {
    timeoutMs?: number
    /**
     * Environment forwarded to the spawned process. Defaults to the
     * parent's env. Pass an env with an augmented `PATH` so the probe
     * resolves binaries the same way the actual export will (relevant on
     * macOS, where Obsidian launches with a stripped PATH).
     */
    env?: SpawnEnv
}

/**
 * Spawns `<bin> --version` and reports whether the binary is reachable on
 * `$PATH` (or at the provided path). Used by the plugin's pre-flight check
 * on load so a missing dependency surfaces as a clear Notice instead of a
 * cryptic Pandoc / Typst error mid-export.
 *
 * Resolves with `ok: false` instead of rejecting — the caller wants to
 * decide what to do, not handle exceptions for an expected condition.
 *
 * The promise self-times out (default 5s). A binary that hangs on
 * `--version` (rare but possible with broken Wine wrappers etc.) would
 * otherwise stall the plugin's `onload`.
 */
export function probeBinary(
    bin: string,
    options: BinaryProbeOptions = {}
): Promise<BinaryProbeResult> {
    const timeoutMs = options.timeoutMs ?? 5000
    return new Promise((resolve) => {
        let settled = false
        const finish = (result: BinaryProbeResult): void => {
            if (settled) return
            settled = true
            resolve(result)
        }

        let proc: ReturnType<typeof spawn>
        try {
            proc = spawn(bin, ['--version'], {
                stdio: ['ignore', 'pipe', 'pipe'],
                env: options.env
            })
        } catch (err) {
            finish({ ok: false, error: err instanceof Error ? err.message : String(err) })
            return
        }

        const stdoutChunks: Uint8Array[] = []
        proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(new Uint8Array(chunk)))
        proc.stderr?.on('data', () => {})

        const timer = window.setTimeout(() => {
            try {
                proc.kill('SIGKILL')
            } catch {
                // ignore
            }
            finish({ ok: false, error: `Timed out after ${String(timeoutMs)}ms` })
        }, timeoutMs)

        proc.on('error', (err) => {
            window.clearTimeout(timer)
            finish({ ok: false, error: err.message })
        })
        proc.on('close', (code) => {
            window.clearTimeout(timer)
            if (code === 0) {
                const stdout = Buffer.concat(stdoutChunks).toString('utf8')
                const firstLine = stdout.split(/\r?\n/, 1)[0]?.trim() ?? ''
                finish({ ok: true, versionLine: firstLine.length > 0 ? firstLine : undefined })
                return
            }
            finish({ ok: false, error: `${bin} --version exited with code ${String(code)}` })
        })
    })
}
