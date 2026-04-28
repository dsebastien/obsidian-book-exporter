# Business Rules

These are mandatory invariants. Changes require explicit user approval.

1. **Desktop only.** The plugin shells out to `pandoc`. `manifest.json` MUST keep `isDesktopOnly: true`.
2. **Any Markdown note can act as a book manifest.** The plugin MUST NOT require a specific tag, folder, or filename. The active note is treated as the manifest; whether it's actually shippable is decided by the validator (chapters present, links resolve, etc.).
3. **Path resolution is always vault-aware.** Code MUST use `app.vault.adapter.getFullPath(...)` to translate vault-relative paths to absolute filesystem paths. Never use `process.cwd()` or relative paths against an unknown CWD.
4. **No vault writes outside `defaultOutputDir` and the plugin's tmp dir.** The plugin must not silently create files anywhere else.
5. **Pandoc is the single external dependency.** The plugin MUST NOT add other tool dependencies (Calibre, KindleGen, custom binaries) without explicit approval. PDF engine selection (Typst / xelatex / etc.) is the user's choice and the plugin only forwards the engine name to Pandoc.
6. **Validation runs before every export.** If the validator reports `hasErrors`, the export is aborted with a Notice; warnings do not block.
7. **Temp files are cleaned up after every export** unless `keepTempFiles` is enabled.
8. **External binaries are never bundled.** The plugin assumes `pandoc` is installed by the user. Failures must be surfaced through a clear Notice instructing the user to install or set the binary path in settings.
9. **Settings remain immutable.** Use `updateSettings(draft => ...)` (Immer) — never reassign `this.settings` directly.
10. **The parser is pure with respect to the vault.** It reads but never writes notes.
