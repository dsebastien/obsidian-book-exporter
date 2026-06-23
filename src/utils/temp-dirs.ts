/**
 * Tracks temp directories created for the *Preview compiled manuscript*
 * command so they can be cleaned up later.
 *
 * Preview cannot delete its temp dir immediately — the command leaves the
 * compiled `manuscript.md` on disk for the user to open in an external
 * editor. Without tracking, every preview would leak a directory under
 * `os.tmpdir()` for the rest of the session (see issue #6). The plugin
 * registers each preview dir here, cleans the previous one before producing a
 * new preview, and removes whatever remains on `onunload`.
 *
 * The remover is injected so the unit tests don't touch the filesystem.
 */
export class PreviewTempDirs {
    private readonly dirs = new Set<string>()

    constructor(private readonly remove: (dir: string) => Promise<void>) {}

    register(dir: string): void {
        this.dirs.add(dir)
    }

    /** Number of tracked dirs not yet cleaned. Exposed for tests/diagnostics. */
    get size(): number {
        return this.dirs.size
    }

    /**
     * Removes every tracked dir and forgets it. Best-effort: a failure to
     * remove one dir (already gone, permissions) is swallowed so it never
     * blocks plugin unload or the next preview.
     */
    async cleanupAll(): Promise<void> {
        const pending = [...this.dirs]
        this.dirs.clear()
        await Promise.all(
            pending.map(async (dir) => {
                try {
                    await this.remove(dir)
                } catch {
                    // best-effort — ignore
                }
            })
        )
    }
}
