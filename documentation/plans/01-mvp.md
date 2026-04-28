# Plan: Book Exporter MVP

## Goal

Turn an Obsidian vault into a book authoring environment. Each book has ONE manifest note that lists the table of contents through wikilinks. Each chapter / section is its own permanent note. The plugin compiles them into a single manuscript and exports to **EPUB** and **PDF**.

## Non-goals (MVP)

- WYSIWYG editing of the manuscript inside Obsidian.
- Round-trip imports (epub → notes).
- Native Obsidian Publish integration (the plugin only produces files; pushing to Publish is a separate concern).
- MOBI export. Modern Kindles + KDP accept EPUB; bundling Calibre wasn't worth the install cost.
- Cross-platform mobile support — desktop only (`isDesktopOnly: true`) because we shell out to `pandoc`.

## Book note conventions

Any Markdown note can be used as a book note — there is no required tag, folder, or filename. The plugin treats the active note as the manifest; if it can't be parsed into a usable book, the validator reports the problem and the export is aborted.

### Frontmatter (book metadata)

The plugin reads these fields. Anything else is ignored.

| Field | Required | Maps to | Notes |
|-------|----------|---------|-------|
| `title` | yes | EPUB / PDF metadata | Falls back to the note's basename. |
| `authors` | yes | metadata | Accepts string or list. |
| `language` | recommended | metadata | BCP-47 (`en`, `fr`). Default `en`. |
| `isbn` | optional | metadata | |
| `publisher` | optional | metadata | |
| `date_published` | optional | metadata | |
| `description` | optional | metadata | |
| `cover` | optional | EPUB cover, PDF cover page | Path inside the vault (resolved via `MetadataCache`) or absolute path. |
| `book_export` | optional | export overrides | Object — see below. |

`book_export` (per-book overrides — all optional):

```yaml
book_export:
  output_dir: "~/Books/My Book"
  pdf_engine: typst                         # typst|weasyprint|xelatex|tectonic|wkhtmltopdf
  toc_depth: 2
  include_toc: true
  page_break_per_chapter: true
  formats: [epub, pdf]
  sections_to_skip: [Related, References]
  pandoc_extra_args: ["--top-level-division=chapter"]
```

### Body (manuscript structure)

The body is a heading tree. The plugin walks it and emits the manuscript in source order. There are no reserved heading names — the structure is yours.

```markdown
# The Context Layer        ← optional body title (frontmatter `title` wins)

## Foreword
- [[Foreword]]

## Part I — The Problem
### Chapter 1 — Why Notes Fail
- [[Why Notes Fail]]
- [[The Cost of Forgetting]]

## Part II — The Solution
### Chapter 3 — Building Context
- [[Building Context]]

## Acknowledgements
- [[Acknowledgements]]
- [[About the Author]]
```

Rules:

- The first `# H1` (if any) sets the body title. Frontmatter `title` wins if both are present. The basename is the last fallback.
- Every `## H2` … `###### H6` is a section at the matching level. Sections nest under the previous higher-level section.
- Every bullet under a section that contains one or more `[[wikilinks]]` contributes them — in source order — to the section's note list. Bullets without wikilinks are kept as part of the section's prose. Text around a wikilink in a wikilink-bearing bullet is dropped (treated as commentary).
- Anything else under a section (paragraphs, tables, blockquotes, code fences, plain bullets) is captured as the section's `prose` and emitted verbatim between the heading and its inlined notes. Lets sections like `## Acknowledgments` carry text without needing wikilinks.
- Bullets that appear before any `## H2` are ignored (no enclosing section).
- Code fences are skipped during parsing.
- Aliased wikilinks (`[[Note|Display]]`) override the linked note's basename when used as a display title.

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
                                └─▶ PandocRunner ──▶ pdf
```

### ManuscriptCompiler responsibilities

- Walk the `BookSection` tree from the manifest. For each section, emit a heading at its level, then the section's `prose` verbatim (paragraphs, plain bullets, tables, blockquotes, code fences kept as-is), then inline its linked notes in order, then recurse into its children.
- Inject a small Typst preamble at the top of the manuscript (raw `{=typst}` block) that styles block quotes (left rule, italicized body) so PDF quotes render cleanly without LaTeX.
- For each inlined note:
  - Strip its YAML frontmatter.
  - Drop configured **sections to skip** (default: `Related`, `References`) — case-insensitive heading match, fence-aware, removes the heading and its body until a same-or-higher heading.
  - Drop the note's first `# H1` (the manifest section title is authoritative).
  - Demote remaining headings to fit underneath the parent section: offset = `parentLevel - 1`, capped at H6.
- Page breaks (when `page_break_per_chapter` is true):
  - **Chapter break** — `\newpage` before each chapter after the first.
  - **Part break** — format-conditional raw blocks (`pagebreak(to: "odd")` for Typst, `\cleardoublepage` for LaTeX, CSS `page-break-before: always` for EPUB) before each part after the first, forcing parts to start on a fresh recto page in print.
  - Decision rule: `partLevel` = lowest-numbered heading level present; `chapterLevel` = the next deeper level (or `partLevel` itself for flat manifests). When `partLevel === chapterLevel` (flat manifest), every top section gets a chapter break. When they differ, siblings at `partLevel` get part breaks; the first child at `chapterLevel` inside a part has no break, subsequent siblings get chapter breaks.
- Transform Obsidian-specific syntax:
  - `[[Note]]` and `[[Note|Alias]]` → resolve via `MetadataCache.getFirstLinkpathDest`. If target is itself part of the manuscript: render as plain text (the alias or basename) — internal links in print don't make sense. If external: render as Markdown link to the note's file path (informational).
  - `![[image.png]]` → standard Markdown image; image path resolved against vault.
  - `![[Note]]` (note embed) → inline expand recursively (depth-limited to avoid cycles).
  - Obsidian callouts (`> [!note] Title`) → rewritten to a Pandoc-friendly fenced div: `::: {.callout .callout-note}\n**Title**\n\n> body\n:::`.
  - `%% comment %%` → stripped.
- Copy referenced images into a `_resources/` subfolder of the temp dir and rewrite paths to be relative.

### Exporter

- Computes output filename: `<slug(title)>_<YYYY-MM-DD>.<ext>` (slugify the title, fall back to book note basename).
- Invokes the Pandoc runner once per requested format. Captures stderr for the "operation failed" notice.
- All temp files live in the OS temp directory (`os.tmpdir()`), in a per-export folder named `obsidian-book-exporter-<bookSlug>-<random>` (created via `fs.mkdtemp`). Never inside the vault. Cleaned up on success unless settings say otherwise (debug mode).
- Output directory is an **absolute filesystem path** configured by the user (with `~` expansion). Empty default; plugin refuses to export until set.

### PandocRunner

Wraps `child_process.spawn` (Node, available in Obsidian desktop):

- `pandoc <manuscript.md> -o <out.epub> --metadata-file <meta.yaml> --epub-cover-image <cover> --toc --toc-depth=N --top-level-division=chapter [extras]`
- The reader format is `markdown+yaml_metadata_block+pipe_tables+task_lists+strikeout+fenced_divs+smart` — `+smart` turns straight quotes into proper curly typographic quotes.
- For PDF: `-o <out.pdf> --pdf-engine=<engine>`. Engine is configurable globally + per book; default is `typst`.
- Resolves binary path: per-book setting > plugin setting > `pandoc` (rely on PATH).
- Writes the metadata-file YAML from `BookManifest` so we don't fight pandoc's CLI metadata parsing.

## Commands

| Command | What it does |
|---------|--------------|
| `book-exporter:export-epub` | Export the active book note to EPUB. |
| `book-exporter:export-pdf` | Export the active book note to PDF. |
| `book-exporter:export-all` | Export to every format listed in `book_export.formats` (or settings default). |
| `book-exporter:preview-manuscript` | Compile the manuscript only — write the combined `.md` to the configured output dir and open it. Useful for debugging. |
| `book-exporter:validate-book` | Parse the active book note, run validations, surface a report (missing wikilink targets, missing required frontmatter, broken images). No export. |
| `book-exporter:open-output-folder` | Reveal the configured output folder in the file manager. |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `pandocPath` | `pandoc` | Full path or name on PATH. |
| `defaultOutputDir` | (empty — required) | Absolute filesystem path. Supports `~`. Plugin refuses to export until set. |
| `defaultPdfEngine` | `typst` | typst / weasyprint / xelatex / tectonic / wkhtmltopdf |
| `defaultLanguage` | `en` | Used when book note doesn't set one. |
| `defaultAuthors` | `[]` | Author names used when the manifest doesn't define `authors:`. Empty falls back to `Anonymous`. |
| `sectionsToSkip` | `[Related, References, Title Options, Target Audience]` | Heading names (case-insensitive). Applied to the manifest body before parsing AND to each linked note when inlining. |
| `includeTocByDefault` | `true` | |
| `tocDepthDefault` | `2` | |
| `pageBreakPerChapterDefault` | `true` | Page break before each top-level section (lowest-numbered heading level used). |
| `defaultFormats` | `[epub, pdf]` | Used by the "all formats" command. |
| `keepTempFiles` | `false` | If true, don't clean tmp dir after export — useful for debugging. |
| `debug` | `false` | Verbose logging. |

## Validation rules

Run by `validate-book` and as a pre-flight before any export. All are blocking unless noted.

1. Active note must be a Markdown file. Any other file type is rejected.
2. `title` must be present (warning if missing — fall back to body H1, then basename).
3. `authors` should be present (warning if missing — falls back to `Anonymous`).
4. The manifest must contain at least one `## H2` (or deeper) section.
5. The manifest must contain at least one resolved wikilink — sections without notes are allowed but a manifest with zero notes overall is rejected.
6. Every wikilink in the manifest must resolve to an existing note.
7. `cover` (if set) must resolve to an existing image inside or outside the vault.
8. `pandoc` must be reachable. (Resolved at command time, not parse time.)
9. Cycle detection in note embeds (`![[Note]]`).

## Architecture

```
src/
├── main.ts                                  # default export of plugin class
└── app/
    ├── plugin.ts                            # BookExporterPlugin
    ├── domain/
    │   ├── book-manifest.intf.ts            # BookMetadata, BookSection, NoteReference, ParsedBook, BookExportOverrides
    │   └── export-options.intf.ts           # ExportFormat, ExportRequest, ExportResult
    ├── services/
    │   ├── book-parser.ts                   # Markdown → ParsedBook
    │   ├── manuscript-compiler.ts           # ParsedBook → single .md
    │   ├── exporter.ts                      # Orchestrator
    │   ├── pandoc-runner.ts                 # spawn pandoc
    │   └── validator.ts                     # validate-book report builder
    ├── commands/commands.ts                 # all commands wired here
    ├── settings/settings-tab.ts             # BookExporterSettingTab
    └── types/plugin-settings.intf.ts        # PluginSettings + DEFAULT_SETTINGS
```

## Out-of-scope follow-ups (post-MVP)

- DOCX / HTML output (one-line addition to PandocRunner).
- Per-chapter export.
- Section ordering by frontmatter `order` field.
- Bundled Pandoc templates / CSS for polished out-of-box typography (Typst defaults are good; LaTeX defaults are decent; we could ship better presets).
- "Watch and re-export on save" mode.
- Picking up the cover from a `cover` image embedded in the book note body.
- Citation rendering via pandoc-citeproc (BibTeX file picker).
- Direct upload to Obsidian Publish.
