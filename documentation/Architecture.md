# Architecture

The plugin is a thin orchestration layer over **Pandoc**. Obsidian provides note IO and the workspace; everything else happens through the file system and child processes.

```
┌────────────────────┐
│ Active manifest    │  Markdown w/ frontmatter + heading tree + bulleted wikilinks
└────────┬───────────┘
         │ (BookParser)
         │   - strips frontmatter
         │   - drops sectionsToSkip from the body (authoring scaffolding)
         │   - walks the heading tree, collects bulleted wikilinks per section
         ▼
┌────────────────────┐
│ ParsedBook         │  metadata + sections: BookSection[]  (recursive heading tree)
└────────┬───────────┘
         │ (ManuscriptCompiler)
         │   - walks the tree, emits each section at its level
         │   - inlines linked notes (strip frontmatter, drop sectionsToSkip,
         │     drop first H1, demote remaining headings, rewrite Obsidian syntax)
         │   - copies referenced images into _resources/
         │   - inserts page breaks before top-level sections (optional)
         ▼
┌────────────────────┐
│ tmp/<bookSlug>/    │  manuscript.md, metadata.yaml, _resources/
└────────┬───────────┘
         │ (Exporter)
         ├── PandocRunner ──▶ <bookSlug>_<date>.epub
         └── PandocRunner ──▶ <bookSlug>_<date>.pdf
```

## Layers

- **`domain/`** — pure types (`ParsedBook`, `BookSection`, `NoteReference`, `BookMetadata`, `ExportFormat`, etc.). No Obsidian or Node dependencies.
- **`services/`** — business logic. The parser is the only service that touches `app.metadataCache` and `app.vault`; everything downstream is fed a `ParsedBook`. The Pandoc runner shells out via `child_process.spawn`.
- **`commands/`** — wires the services to Obsidian commands and shows feedback through `Notice`.
- **`settings/`** — `BookExporterSettingTab` reads/writes the immer-managed `PluginSettings`.
- **`types/`** — `PluginSettings` + `DEFAULT_SETTINGS`.
- **`utils/`** — small helpers (`log`, `openExternal`).

## External dependencies

Pandoc is the only hard prerequisite. There is no production-ready JS port of Pandoc and bundling the binary is impractical, so we treat it as a system dependency the user installs once.

For PDF, Pandoc dispatches to a configurable engine. Default is **Typst** — single small binary, no LaTeX install needed, professional output. xelatex / tectonic / weasyprint / wkhtmltopdf remain available for users who already have them.

## Key invariants

- Path resolution is **always** done through `app.vault.adapter.getFullPath()` — never assume `process.cwd()` or anything else.
- The compiler writes to a private temp directory under the plugin's config dir. The exporter cleans it up unless `keepTempFiles` is set.
- Pandoc is given a YAML metadata file rather than CLI metadata flags. This avoids escaping issues with non-ASCII titles.
