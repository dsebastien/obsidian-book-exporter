---
title: Overview
nav_order: 1
permalink: /
---

# Book Exporter

Write a book inside an Obsidian vault — one **manifest note** lists the table of contents, each chapter and section is its own note. The plugin compiles the structure into a single manuscript and exports to **EPUB**, **PDF**, and **MOBI** via [Pandoc](https://pandoc.org) and [Calibre](https://calibre-ebook.com).

> Desktop only. Requires `pandoc` (and `ebook-convert` for MOBI) on `$PATH` — or set the binary paths in settings.

## Key features

- **One note = one book.** The manifest note holds the metadata and the table of contents through wikilinks. Chapters and sections live in their own notes.
- **No required tag, folder or filename.** Any Markdown note can be used as a manifest.
- **EPUB, PDF, MOBI.** Configurable PDF engine (xelatex / weasyprint / wkhtmltopdf / tectonic / typst). MOBI is built from the EPUB through Calibre.
- **Validation before export.** Missing chapters, broken wikilinks, and missing required metadata are surfaced with a clear report — no half-baked exports.
- **Per-book overrides.** A `book_export:` block in the manifest's frontmatter overrides plugin-level defaults (output folder, PDF engine, formats, TOC depth, page-break behaviour, extra Pandoc flags).
- **Manuscript preview.** A dedicated command writes the compiled `.md` and opens it — useful for checking what Pandoc will see.

## Quick start

1. Install the plugin (manual install or via [BRAT](https://github.com/TfTHacker/obsidian42-brat)).
2. Install [Pandoc](https://pandoc.org/installing.html). For PDF, install [Tectonic](https://tectonic-typesetting.github.io), [TeX Live](https://www.tug.org/texlive/), Weasyprint or [Typst](https://typst.app). For MOBI, install [Calibre](https://calibre-ebook.com).
3. Create a manifest note (see [Usage](usage.md) for the structure).
4. From the command palette, run **Book Exporter: Export current book to EPUB** (or PDF / MOBI / all formats).

## About

Created by [Sébastien Dubois](https://dsebastien.net). Source code, issues and roadmap on [GitHub](https://github.com/dsebastien/obsidian-book-exporter).

If this plugin helps you ship a book, [buy me a coffee](https://www.buymeacoffee.com/dsebastien) ☕.
