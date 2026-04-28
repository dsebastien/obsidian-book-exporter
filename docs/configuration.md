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
| Default output folder | string | `Exports/Books` | Vault-relative folder for exports. Created if missing. |
| Default formats | comma list | `epub,pdf` | Used by **Export to all formats** when the manifest doesn't specify any. |
| PDF engine | enum | `typst` | `typst` (recommended) / `weasyprint` / `xelatex` / `tectonic` / `wkhtmltopdf`. |
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
| `formats` | list | Formats produced by **Export to all formats**. Subset of `[epub, pdf]`. |
| `pandoc_extra_args` | list of strings | Extra arguments forwarded to Pandoc verbatim. |

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
