/**
 * Opens a path (file or folder, vault-internal or absolute) with the OS's
 * default handler via Electron's `shell` module. Uses Obsidian's CommonJS
 * `require` because typed Electron bindings aren't shipped with the plugin.
 */
type ShellApi = { openPath(path: string): Promise<string> }

function getShell(): ShellApi | null {
    try {
        const req = (window as unknown as { require?: (mod: string) => unknown }).require
        if (typeof req !== 'function') return null
        const electron = req('electron') as { shell?: ShellApi } | null
        return electron?.shell ?? null
    } catch {
        return null
    }
}

export async function openExternal(path: string): Promise<void> {
    const shell = getShell()
    if (shell === null) return
    await shell.openPath(path)
}
