---
title: Configuration
nav_order: 3
---

# Configuration

The plugin has two layers of configuration: **plugin settings** (apply to every book) and **per-book overrides** (defined in the manifest's frontmatter, override the corresponding plugin setting).

## Plugin settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Pandoc path | string | `pandoc` | Full path or PATH name. |
| Calibre `ebook-convert` path | string | `ebook-convert` | Required for MOBI. |
| Default output folder | string | `Exports/Books` | Vault-relative folder for exports. Created if missing. |
| Default formats | comma list | `epub,pdf,mobi` | Used by **Export to all formats** when the manifest doesn't specify any. |
| PDF engine | enum | `xelatex` | `xelatex` / `weasyprint` / `wkhtmltopdf` / `tectonic` / `typst`. |
| Default language | BCP-47 | `en` | Used when the manifest doesn't set `language`. |
| Front-matter heading | string | `Front Matter` | Body heading for the front-matter list. |
| Chapters heading | string | `Chapters` | Body heading for the chapters list. |
| Back-matter heading | string | `Back Matter` | Body heading for the back-matter list. |
| Include TOC by default | boolean | true | Adds `--toc` to Pandoc. |
| TOC depth | integer | 2 | `--toc-depth=N`. |
| Page break per chapter | boolean | true | Inserts a hard page break between chapters. |
| Keep temporary files | boolean | false | Debug — keeps the compiled manuscript and resources after export. |
| Verbose console logging | boolean | false | Debug. |

## Per-book overrides (`book_export`)

Add a `book_export:` block to the manifest's frontmatter. All keys are optional; missing keys fall back to the plugin setting.

```yaml
book_export:
  output_dir: "60 Archives/Books/Exports"
  pdf_engine: typst
  toc_depth: 3
  include_toc: true
  page_break_per_chapter: true
  formats: [epub, pdf]
  pandoc_extra_args:
    - --top-level-division=chapter
    - --resource-path=.
```

| Key | Type | Description |
|-----|------|-------------|
| `output_dir` | string | Vault-relative output folder for this book. |
| `pdf_engine` | enum | Overrides the global PDF engine. |
| `toc_depth` | integer | Overrides the global TOC depth. |
| `include_toc` | boolean | Whether to include a TOC for this book. |
| `page_break_per_chapter` | boolean | Page-break behaviour for this book. |
| `formats` | list | Formats produced by **Export to all formats**. Subset of `[epub, pdf, mobi]`. |
| `pandoc_extra_args` | list of strings | Extra arguments forwarded to Pandoc verbatim. |

## External tools

| Tool | Required for | Install |
|------|--------------|---------|
| Pandoc ≥ 3.x | EPUB, PDF | <https://pandoc.org/installing.html> |
| A PDF engine | PDF | xelatex (TeX Live / MikTeX), [Tectonic](https://tectonic-typesetting.github.io), [Typst](https://typst.app), Weasyprint, wkhtmltopdf |
| Calibre `ebook-convert` | MOBI | <https://calibre-ebook.com/download> |

If a binary is not on `$PATH`, set its full path in **Settings → Book Exporter**.
