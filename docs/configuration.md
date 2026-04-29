---
title: Configuration
nav_order: 3
---

# Configuration

Two layers: **plugin settings** (apply to every book) and **per-book overrides** (defined in the manifest's frontmatter, override the matching plugin setting).

## Plugin settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Pandoc path | string | `pandoc` | Required. Full path or PATH name. |
| Default output folder | string | (empty — required) | **Absolute filesystem path** where exported books are written. `~` is expanded to your home directory. The plugin refuses to export until this is set. Examples: `~/Downloads`, `/home/me/Books`. |
| Default formats | comma list | `epub,pdf` | Used by **Export to all formats** when the manifest doesn't specify any. |
| PDF engine | enum | `typst` | `typst` (recommended) / `weasyprint` / `xelatex` / `tectonic` / `wkhtmltopdf`. |
| Default language | BCP-47 | `en` | Used when the manifest doesn't set `language`. |
| Default author(s) | comma list | (empty) | Used when the manifest doesn't define `authors:` in its frontmatter. Empty falls back to `Anonymous` (with a warning). |
| Cover frontmatter property | string | `cover` | Frontmatter key read for the book cover image. Set this to `cover_image`, `cover_url`, or whatever name fits your frontmatter conventions. The value can be a vault-relative path, an absolute path, an `[[wikilink]]`, or an `http(s)` URL (downloaded to the temp folder before pandoc runs). |
| Sections to skip | comma list | `Related, References, Title Options, Target Audience` | Heading names (case-insensitive). Applied to the manifest body before parsing (drops authoring scaffolding) AND to each linked note when inlining (drops housekeeping sections). |
| Inlined-note separator | enum | `none` | Visual cue between successive notes inside the same section. `none` keeps the legacy run-on layout; `rule` emits a centred `* * *` glyph rule; `blank` adds extra spacing; `subheading` renders each note's display title as a heading one level below the section heading. Per-book override: `book_export.inlined_note_separator`. |
| Inline note embeds | boolean | false | When on, `![[Note]]` embeds inside inlined notes are recursively expanded with the embedded note's body. Default off — embeds are dropped (only image embeds are kept). |
| Note embed max depth | integer | 3 | Maximum recursion depth for note-embed expansion. 1 = direct embeds only; 2 = embeds of embeds; etc. Embeds at the depth limit are replaced with their display title. |
| Typst image width | string | `100%` | Forwarded as `#set image(width: <value>)` in the Typst preamble. Caps every image when the PDF engine is Typst. Accepts any Typst length (`100%`, `80%`, `15cm`). Leave empty to disable. |
| Include TOC by default | boolean | true | Adds `--toc` to Pandoc. |
| Auto TOC depth | boolean | true | When on, the TOC depth is derived from the deepest heading level actually present in the manifest (parts + chapters → 3, flat chapters → 2). Disable to use the static fallback. Per-book `book_export.toc_depth` always wins. |
| TOC depth (fallback) | integer | 2 | `--toc-depth=N`. Used only when **Auto TOC depth** is off, or when the manifest has no parseable heading. |
| Page break per chapter | boolean | true | Inserts a page break before each top-level section (the lowest-numbered heading level used in the manifest). |
| Keep temporary files | boolean | false | Debug — keeps the compiled manuscript and resources after export. |
| Verbose console logging | boolean | false | Debug. |

## Per-book overrides (`book_export`)

Add a `book_export:` block to the manifest's frontmatter. All keys are optional; missing keys fall back to the plugin setting.

```yaml
book_export:
  output_dir: "~/Books/The Context Layer"
  pdf_engine: typst
  toc_depth: 3
  include_toc: true
  page_break_per_chapter: true
  formats: [epub, pdf]
  sections_to_skip: [Related, References, Notes]
  inlined_note_separator: rule
  pandoc_extra_args:
    - --top-level-division=chapter
    - --resource-path=.
```

| Key | Type | Description |
|-----|------|-------------|
| `output_dir` | string | Absolute filesystem path for this book's exports. Supports `~`. Overrides the global setting. |
| `pdf_engine` | enum | Overrides the global PDF engine. |
| `toc_depth` | integer | Overrides the global TOC depth. |
| `include_toc` | boolean | Whether to include a TOC for this book. |
| `page_break_per_chapter` | boolean | Page-break behaviour for this book. |
| `formats` | list | Formats produced by **Export to all formats**. Subset of `[epub, pdf]`. |
| `sections_to_skip` | list | Heading names (case-insensitive). Applied to both the manifest body and linked notes. Replaces — does not extend — the global setting. |
| `inlined_note_separator` | enum | `none` / `rule` / `blank` / `subheading`. Overrides the plugin setting for this book. |
| `front_matter_sections` | list | Top-level section titles (case-insensitive) treated as **front matter** — pages numbered with lowercase roman numerals (`i`, `ii`, ...). The first non-matching top-level section starts body matter and resets numbering to arabic (`1`, `2`, ...). Only meaningful for Typst and LaTeX targets. Example: `[Foreword, Preface, Acknowledgements]`. |
| `pandoc_extra_args` | list of strings | Extra arguments forwarded to Pandoc verbatim. |

## Where files go

- **Exports** — written to the configured **Default output folder** (or per-book `book_export.output_dir`). Absolute filesystem paths only; `~` is expanded. The plugin refuses to export when the folder is not configured.
- **Temp files** — created inside the OS temp directory (`os.tmpdir()`, e.g. `/tmp/obsidian-book-exporter-<book>-<random>/` on Linux). Never inside your vault. Cleaned up automatically after each export unless **Keep temporary files** is on.

## External tools

| Tool | Required for | Install |
|------|--------------|---------|
| Pandoc ≥ 3.x | EPUB, PDF | <https://pandoc.org/installing.html> |
| Typst | PDF (recommended) | <https://typst.app> — single small binary, beautiful output, fast |
| xelatex / tectonic | PDF (alternatives) | only if you already have a TeX setup |
| Weasyprint / wkhtmltopdf | PDF (alternatives) | HTML/CSS-based; lower typographic quality than Typst or LaTeX |

If a binary is not on `$PATH`, set its full path in **Settings → Book Exporter**.

## PDF quality notes

The default engine is **Typst** for one reason: it gives professional book typography (proper page breaks, no split images, hyphenation, widow/orphan control) without the install pain of LaTeX. xelatex / tectonic produce comparable output if you already have them. Weasyprint and wkhtmltopdf are HTML-rendering engines — fine for short documents, weaker for books, kept for completeness.
