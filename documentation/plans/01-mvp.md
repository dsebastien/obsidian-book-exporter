# Plan: Book Exporter MVP

## Goal

Turn an Obsidian vault into a book authoring environment. Each book has ONE manifest note (the "book note", e.g. `[[The Context Layer (Book)]]`) that lists the table of contents through wikilinks. Each chapter / section is its own permanent note. The plugin compiles them into a single manuscript and exports to **EPUB**, **PDF**, and **MOBI**.

## Non-goals (MVP)

- WYSIWYG editing of the manuscript inside Obsidian.
- Round-trip imports (epub → notes).
- Native Obsidian Publish integration (the plugin only produces files; pushing to Publish is a separate concern).
- Cross-platform mobile support — desktop only (`isDesktopOnly: true`) because we shell out to `pandoc` and `ebook-convert`.

## Book note conventions

A book note is any note tagged `type/creation/book` (own-books type). The plugin recognizes the active note as a book note when its frontmatter or tags match.

### Frontmatter (book metadata)

The plugin reads these fields. Anything else is ignored.

| Field | Required | Maps to | Notes |
|-------|----------|---------|-------|
| `title` | yes | EPUB / PDF metadata | Falls back to the note's basename without ` (Book)` suffix. |
| `authors` | yes | metadata | Accepts string or list. |
| `language` | recommended | metadata | BCP-47 (`en`, `fr`). Default `en`. |
| `isbn` | optional | metadata | |
| `publisher` | optional | metadata | Default DeveloPassion. |
| `date_published` | optional | metadata | |
| `description` | optional | metadata | |
| `cover` | optional | EPUB cover, PDF cover page | Path inside the vault (resolved via `MetadataCache`) or absolute path. |
| `book_export` | optional | export overrides | Object — see below. |

`book_export` (per-book overrides — all optional):

```yaml
book_export:
  output_dir: "60 Archives/Books/Exports"   # relative to vault root
  pdf_engine: xelatex                       # xelatex|weasyprint|wkhtmltopdf|tectonic|typst
  toc_depth: 2                              # passed to pandoc --toc-depth
  include_toc: true
  page_break_per_chapter: true
  formats: [epub, pdf, mobi]                # default for "export all"
  pandoc_extra_args: ["--top-level-division=chapter"]
```

### Body (manuscript structure)

Three top-level sections, parsed in this exact order regardless of what comes between them:

```markdown
## Front Matter
- [[Foreword]]
- [[Preface]]

## Chapters
- [[Chapter 1 - The Problem]]
  - [[Chapter 1.1 - Why Notes Fail]]
  - [[Chapter 1.2 - The Cost]]
- [[Chapter 2 - The Solution]]

## Back Matter
- [[Acknowledgements]]
- [[About the Author]]
```

Rules:

- Heading names are configurable (default: `Front Matter`, `Chapters`, `Back Matter`).
- Each top-level bullet under `Chapters` is a chapter. Nested bullets are sections of that chapter.
- Each bullet must contain exactly one `[[wikilink]]`. Anything else is ignored.
- Order of bullets is preserved.
- `Front Matter` and `Back Matter` are optional. `Chapters` is required.
- Anything else in the book note (intro paragraphs, references, notes) is ignored by the exporter.

## Compilation pipeline

```
Book note ──▶ BookParser ──▶ ParsedBook (manifest + ordered FilePaths)
                                    │
                                    ▼
                            ManuscriptCompiler ──▶ single .md (vault-temp dir)
                                    │
                                    ▼
                            Exporter (orchestrator)
                                ├─▶ PandocRunner ──▶ epub
                                ├─▶ PandocRunner ──▶ pdf
                                └─▶ CalibreRunner (epub→mobi)
```

### ManuscriptCompiler responsibilities

- Strip every chapter's YAML frontmatter.
- Normalize headings: a chapter note's first H1 (if any) is dropped; all remaining headings are demoted by 1 (H2→H3, etc.) so that the chapter title (synthesized from the wikilink) becomes the H1. For sections nested under chapters: H1 dropped, headings demoted by 2.
- Insert a hard page break (`\newpage` for LaTeX, `<div style="page-break-before: always"></div>` for HTML/EPUB) between chapters when `page_break_per_chapter` is true.
- Transform Obsidian-specific syntax:
  - `[[Note]]` and `[[Note|Alias]]` → resolve via `MetadataCache.getFirstLinkpathDest`. If target is itself part of the manuscript: render as plain text (the alias or basename) — internal links in print don't make sense. If external: render as Markdown link to the note's file path (informational).
  - `![[image.png]]` → standard Markdown image; image path resolved against vault.
  - `![[Note]]` (note embed) → inline expand recursively (depth-limited to avoid cycles).
  - Obsidian callouts (`> [!note] Title`) → rewritten to a Pandoc-friendly fenced div: `::: {.callout .callout-note}\n**Title**\n\n> body\n:::`.
  - `%% comment %%` → stripped.
- Copy referenced images into a `_resources/` subfolder of the temp dir and rewrite paths to be relative.

### Exporter

- Computes output filename: `<slug(title)>_<YYYY-MM-DD>.<ext>` (slugify the title, fall back to book note basename).
- Invokes runners. Captures stderr for the "operation failed" notice.
- All temp files live under `{vault}/.obsidian/plugins/obsidian-book-exporter/tmp/<bookId>/`. Cleaned up on success unless settings say otherwise (debug mode).

### PandocRunner

Wraps `child_process.spawn` (Node, available in Obsidian desktop):

- `pandoc <manuscript.md> -o <out.epub> --metadata-file <meta.yaml> --epub-cover-image <cover> --toc --toc-depth=N --top-level-division=chapter [extras]`
- For PDF: `-o <out.pdf> --pdf-engine=<engine>`. Engine is configurable globally + per book.
- Resolves binary path: per-book setting > plugin setting > `pandoc` (rely on PATH).
- Writes the metadata-file YAML from `BookManifest` so we don't fight pandoc's CLI metadata parsing.

### CalibreRunner

- For MOBI: `ebook-convert <book.epub> <book.mobi>`.
- Calibre is required for mobi. If `ebook-convert` isn't found, surface a clear error notice with a link to install instructions.
- Note: Amazon KDP no longer requires MOBI (accepts EPUB since 2022). MOBI export remains for sideloading and legacy Kindles.

## Commands

| Command | What it does |
|---------|--------------|
| `book-exporter:export-epub` | Export the active book note to EPUB. |
| `book-exporter:export-pdf` | Export the active book note to PDF. |
| `book-exporter:export-mobi` | Export the active book note to MOBI (via EPUB intermediate). |
| `book-exporter:export-all` | Export to every format listed in `book_export.formats` (or settings default). |
| `book-exporter:preview-manuscript` | Compile the manuscript only — write the combined `.md` to the configured output dir and open it. Useful for debugging. |
| `book-exporter:validate-book` | Parse the active book note, run validations, surface a report (missing wikilink targets, missing required frontmatter, broken images). No export. |
| `book-exporter:open-output-folder` | Reveal the configured output folder in the file manager. |

All commands except `validate` and `preview` require a saved active note tagged `type/creation/book`. They display Notice messages on success/failure and write a transient log to the plugin's tmp dir.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `pandocPath` | `pandoc` | Full path or name on PATH. |
| `ebookConvertPath` | `ebook-convert` | Calibre's converter. |
| `defaultOutputDir` | `Exports/Books` | Vault-relative. |
| `defaultPdfEngine` | `xelatex` | xelatex / weasyprint / wkhtmltopdf / tectonic / typst |
| `defaultLanguage` | `en` | Used when book note doesn't set one. |
| `frontMatterHeading` | `Front Matter` | Body heading for front matter. |
| `chaptersHeading` | `Chapters` | Body heading for chapters. |
| `backMatterHeading` | `Back Matter` | Body heading for back matter. |
| `includeTocByDefault` | `true` | |
| `tocDepthDefault` | `2` | |
| `pageBreakPerChapterDefault` | `true` | |
| `keepTempFiles` | `false` | If true, don't clean tmp dir after export — useful for debugging. |
| `debug` | `false` | Verbose logging. |

## Validation rules

Run by `validate-book` and as a pre-flight before any export. All are blocking unless noted.

1. Active note must be a book note (own-books type / `type/creation/book` tag).
2. `title` and `authors` must be present (warning if missing — fall back to basename / `Anonymous`).
3. The `Chapters` heading must exist and contain at least one bullet with a wikilink.
4. Every bullet under each tracked heading must have exactly one wikilink that resolves to an existing note.
5. `cover` (if set) must resolve to an existing image inside or outside the vault.
6. `pandoc` (and `ebook-convert` when MOBI requested) must be reachable. (Resolved at command time, not parse time.)
7. Cycle detection in note embeds (`![[Note]]`).

## Architecture

```
src/
├── main.ts                                  # default export of plugin class
└── app/
    ├── plugin.ts                            # BookExporterPlugin
    ├── domain/
    │   ├── book-manifest.intf.ts            # BookManifest, BookEntry, ParsedBook
    │   └── export-options.intf.ts           # ExportFormat, ExportRequest, ExportResult
    ├── services/
    │   ├── book-parser.ts                   # Markdown → ParsedBook
    │   ├── manuscript-compiler.ts           # ParsedBook → single .md
    │   ├── exporter.ts                      # Orchestrator
    │   ├── pandoc-runner.ts                 # spawn pandoc
    │   ├── calibre-runner.ts                # spawn ebook-convert
    │   └── validator.ts                     # validate-book report builder
    ├── commands/
    │   ├── export-current-book.ts           # factory for export commands
    │   ├── preview-manuscript.ts
    │   ├── validate-book.ts
    │   └── open-output-folder.ts
    ├── settings/
    │   └── settings-tab.ts                  # BookExporterSettingTab
    └── types/
        └── plugin-settings.intf.ts          # PluginSettings + DEFAULT_SETTINGS
```

## Out-of-scope follow-ups (post-MVP)

- DOCX / HTML output (one-line addition to PandocRunner).
- Per-chapter export.
- Section ordering by frontmatter `order` field.
- CSS/Tex theme picker.
- "Watch and re-export on save" mode.
- Picking up the cover from a `cover` image embedded in the book note body.
- Citation rendering via pandoc-citeproc (BibTeX file picker).
- Direct upload to Obsidian Publish.
