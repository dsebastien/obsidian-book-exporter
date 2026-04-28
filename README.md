# Obsidian Book Exporter

Write a book inside an Obsidian vault — one **book note** acts as the manifest (table of contents), each chapter / section is its own note. The plugin compiles the structure into a single manuscript and exports to **EPUB**, **PDF**, and **MOBI** via [Pandoc](https://pandoc.org) and [Calibre](https://calibre-ebook.com).

> Desktop only. Requires `pandoc` (and `ebook-convert` for MOBI) on `$PATH` — or configure the binary paths in settings.

## How it works

1. Create a book note tagged `type/creation/book`. Put book metadata in the frontmatter.
2. List the chapters / sections in the body, under headings the plugin recognizes.
3. Run **Export current book to EPUB / PDF / MOBI** from the command palette.

### Example book note

```markdown
---
title: The Context Layer
authors: [Sébastien Dubois]
language: en
publisher: DeveloPassion
description: A book about turning notes into knowledge.
cover: covers/the-context-layer.jpg
tags: [type/creation/book]
book_export:
  formats: [epub, pdf]
  pdf_engine: xelatex
  page_break_per_chapter: true
---

# The Context Layer (Book)

## Front Matter
- [[Foreword]]
- [[Preface]]

## Chapters
- [[Chapter 1 - The Problem]]
  - [[Chapter 1 - Section 1 - Why Notes Fail]]
  - [[Chapter 1 - Section 2 - The Cost]]
- [[Chapter 2 - The Solution]]

## Back Matter
- [[Acknowledgements]]
- [[About the Author]]
```

## Commands

- `Book Exporter: Export current book to EPUB`
- `Book Exporter: Export current book to PDF`
- `Book Exporter: Export current book to MOBI`
- `Book Exporter: Export current book to all formats`
- `Book Exporter: Preview compiled manuscript (.md)`
- `Book Exporter: Validate current book`
- `Book Exporter: Open exports folder`

## Installation

### From source

```bash
git clone https://github.com/dsebastien/obsidian-book-exporter.git
cd obsidian-book-exporter
bun install
export OBSIDIAN_VAULT_LOCATION="/path/to/your/vault"
bun run dev
```

The dev build copies the plugin into `<vault>/.obsidian/plugins/obsidian-book-exporter/` automatically and writes a `.hotreload` marker for the [Hot Reload](https://github.com/pjeby/hot-reload) plugin.

## External tools

| Tool | Required for | Install |
|------|--------------|---------|
| pandoc ≥ 3.x | EPUB, PDF | https://pandoc.org/installing.html |
| A LaTeX engine (xelatex / tectonic / typst) | PDF | distro package or [TeX Live](https://www.tug.org/texlive/) / [Tectonic](https://tectonic-typesetting.github.io) |
| Calibre `ebook-convert` | MOBI | https://calibre-ebook.com/download |

## Status

Pre-release. Unstable. See `documentation/plans/01-mvp.md` for the design and `documentation/history/` for the change log.

## License

MIT. See `LICENSE`.
