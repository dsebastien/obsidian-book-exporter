# Architecture

The plugin is a thin orchestration layer over **Pandoc** and **Calibre's `ebook-convert`**. Obsidian provides note IO and the workspace; everything else happens through the file system and child processes.

```
┌────────────────────┐
│ Active book note   │  Markdown w/ frontmatter + TOC
└────────┬───────────┘
         │ (BookParser)
         ▼
┌────────────────────┐
│ ParsedBook         │  metadata + ordered FilePath[]
└────────┬───────────┘
         │ (ManuscriptCompiler)
         ▼
┌────────────────────┐
│ tmp/<bookSlug>/    │  manuscript.md, metadata.yaml, _resources/
└────────┬───────────┘
         │ (Exporter)
         ├── PandocRunner ──▶ <bookSlug>_<date>.epub
         ├── PandocRunner ──▶ <bookSlug>_<date>.pdf
         └── CalibreRunner ─▶ <bookSlug>_<date>.mobi
```

## Layers

- **`domain/`** — pure types (`ParsedBook`, `BookEntry`, `BookMetadata`, `ExportFormat`, etc.). No Obsidian or Node dependencies.
- **`services/`** — business logic. The parser is the only service that touches `app.metadataCache` and `app.vault`; everything downstream is fed a `ParsedBook`. Runners shell out via `child_process.spawn`.
- **`commands/`** — wires the services to Obsidian commands and shows feedback through `Notice`.
- **`settings/`** — `BookExporterSettingTab` reads/writes the immer-managed `PluginSettings`.
- **`types/`** — `PluginSettings` + `DEFAULT_SETTINGS`.
- **`utils/`** — small helpers (`log`, `openExternal`).

## Key invariants

- Path resolution is **always** done through `app.vault.adapter.getFullPath()` — never assume `process.cwd()` or anything else.
- The compiler writes to a private temp directory under the plugin's config dir. The exporter cleans it up unless `keepTempFiles` is set.
- Pandoc is given a YAML metadata file rather than CLI metadata flags. This avoids escaping issues with non-ASCII titles.
- MOBI is built from the EPUB intermediate. If only MOBI is requested, the EPUB is still produced, then deleted afterwards.
