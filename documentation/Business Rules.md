# Business Rules

These are mandatory invariants. Changes require explicit user approval.

1. **Desktop only.** The plugin shells out to `pandoc`. `manifest.json` MUST keep `isDesktopOnly: true`.
2. **Any Markdown note can act as a book manifest.** The plugin MUST NOT require a specific tag, folder, or filename. The active note is treated as the manifest; whether it's actually shippable is decided by the validator (chapters present, links resolve, etc.).
3. **Output directory is an absolute filesystem path, configured by the user.** Default is empty; the plugin MUST refuse to export with a clear Notice until the user sets it. `~` is expanded to the home directory. Per-book `book_export.output_dir` overrides the global setting and follows the same rules.
4. **Temp files live in the OS temp directory.** Use `os.tmpdir()` + `fs.mkdtemp()`. The plugin MUST NOT write temp files inside the vault, inside its own plugin folder, or anywhere else outside the configured output directory and the OS temp directory.
5. **Pandoc is the single external dependency.** The plugin MUST NOT add other tool dependencies (Calibre, KindleGen, custom binaries) without explicit approval. PDF engine selection (Typst / xelatex / etc.) is the user's choice and the plugin only forwards the engine name to Pandoc.
6. **Validation runs before every export.** If the validator reports `hasErrors`, the export is aborted with a Notice; warnings do not block.
7. **Temp files are cleaned up after every export** unless `keepTempFiles` is enabled.
8. **External binaries are never bundled.** The plugin assumes `pandoc` is installed by the user. Failures must be surfaced through a clear Notice instructing the user to install or set the binary path in settings.
9. **Settings remain immutable.** Use `updateSettings(draft => ...)` (Immer) — never reassign `this.settings` directly.
10. **The parser is pure with respect to the vault.** It reads but never writes notes.
11. **The manifest contract is heading-driven and structure-agnostic.** `# H1` is the title (or use frontmatter `title`). Every `## H2` … `###### H6` becomes a section at the matching level. Bullets with one or more wikilinks contribute notes (in source order) to the current section. The plugin MUST NOT enforce reserved heading names ("Front Matter", "Chapters", "Back Matter", etc.) or assume a particular structural shape (parts/chapters vs flat chapters).
12. **Inlining is non-destructive to the source notes.** The cleanup steps (strip frontmatter, skip configured sections, drop first H1, demote headings, rewrite Obsidian syntax) operate on a copy of the note's content in the temp manuscript. Source notes in the vault are never modified.
