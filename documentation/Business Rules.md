# Business Rules

These are mandatory invariants. Changes require explicit user approval.

1. **Desktop only.** The plugin shells out to `pandoc` and `ebook-convert`. `manifest.json` MUST keep `isDesktopOnly: true`.
2. **A book note is identified by tag `type/creation/book`** (own-books type). Detection MUST go through `MetadataCache` so frontmatter `tags` and inline `#tags` are both honoured. Never recognize a book note from filename or folder alone.
3. **Path resolution is always vault-aware.** Code MUST use `app.vault.adapter.getFullPath(...)` to translate vault-relative paths to absolute filesystem paths. Never use `process.cwd()` or relative paths against an unknown CWD.
4. **No vault writes outside `defaultOutputDir` and the plugin's tmp dir.** The plugin must not silently create files anywhere else.
5. **MOBI requires a working EPUB.** The exporter must always produce the EPUB intermediate when MOBI is requested, then convert.
6. **Validation runs before every export.** If the validator reports `hasErrors`, the export is aborted with a Notice; warnings do not block.
7. **Temp files are cleaned up after every export** unless `keepTempFiles` is enabled.
8. **External binaries are never bundled.** The plugin assumes `pandoc` and `ebook-convert` are installed by the user. Failures must be surfaced through a clear Notice instructing the user to install or set the binary path in settings.
9. **Settings remain immutable.** Use `updateSettings(draft => ...)` (Immer) — never reassign `this.settings` directly.
10. **`isBookNote` and the parser are pure with respect to the vault.** They read but never write notes.
