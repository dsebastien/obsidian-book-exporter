---
title: Overview
nav_order: 1
permalink: /
---

# Book Exporter

Write a book inside an Obsidian vault — one **manifest note** lists the table of contents, each chapter and section is its own note. The plugin compiles the structure into a single manuscript and exports to **EPUB** and **PDF** via [Pandoc](https://pandoc.org).

> Desktop only. Requires `pandoc` on `$PATH` — or set the path in settings. For PDF, [Typst](https://typst.app) is the recommended engine: a single small binary with output quality close to LaTeX.

## Key features

- **One note = one book.** The manifest note holds the metadata and the table of contents through wikilinks. Chapters and sections live in their own notes.
- **No required tag, folder or filename.** Any Markdown note can be used as a manifest.
- **EPUB and PDF.** Configurable PDF engine (Typst by default; xelatex / tectonic / weasyprint / wkhtmltopdf available).
- **Validation before export.** Missing chapters, broken wikilinks, and missing required metadata are surfaced with a clear report — no half-baked exports.
- **Per-book overrides.** A `book_export:` block in the manifest's frontmatter overrides plugin-level defaults (output folder, PDF engine, formats, TOC depth, page-break behaviour, extra Pandoc flags).
- **Manuscript preview.** A dedicated command writes the compiled `.md` and opens it — useful for checking what Pandoc will see.

## Why Pandoc?

Pandoc is the industry-standard document converter. There is no production-ready library port for JavaScript / Node, and bundling Pandoc itself is impractical (multi-platform binary, hundreds of MB). The plugin treats Pandoc as a hard prerequisite — that's the price for high-quality output. Install once, export forever.

## Quick start

1. Install the plugin (manual install or via [BRAT](https://github.com/TfTHacker/obsidian42-brat)).
2. Install [Pandoc](https://pandoc.org/installing.html). For PDF, install [Typst](https://typst.app) (recommended).
3. Open any Markdown note and structure it as a manifest (see [Usage](usage.md)).
4. From the command palette, run **Book Exporter: Export current book to EPUB** (or PDF / all formats).

## About

Created by [Sébastien Dubois](https://dsebastien.net). Source code, issues and roadmap on [GitHub](https://github.com/dsebastien/obsidian-book-exporter).

If this plugin helps you ship a book, [buy me a coffee](https://www.buymeacoffee.com/dsebastien) ☕.
