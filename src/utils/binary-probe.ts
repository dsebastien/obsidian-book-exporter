import { spawn } from 'node:child_process'

export interface BinaryProbeResult {
    ok: boolean
    /** First line of stdout when the probe succeeded. */
    versionLine?: string
    /** Human-readable error message when the probe failed. */
    error?: string
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
export function probeBinary(bin: string, timeoutMs = 5000): Promise<BinaryProbeResult> {
    return new Promise((resolve) => {
        let settled = false
        const finish = (result: BinaryProbeResult): void => {
            if (settled) return
            settled = true
            resolve(result)
        }

        let proc: ReturnType<typeof spawn>
        try {
            proc = spawn(bin, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
        } catch (err) {
            finish({ ok: false, error: err instanceof Error ? err.message : String(err) })
            return
        }

        const stdoutChunks: Uint8Array[] = []
        proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(new Uint8Array(chunk)))
        proc.stderr?.on('data', () => {})

        const timer = setTimeout(() => {
            try {
                proc.kill('SIGKILL')
            } catch {
                // ignore
            }
            finish({ ok: false, error: `Timed out after ${String(timeoutMs)}ms` })
        }, timeoutMs)

        proc.on('error', (err) => {
            clearTimeout(timer)
            finish({ ok: false, error: err.message })
        })
        proc.on('close', (code) => {
            clearTimeout(timer)
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
