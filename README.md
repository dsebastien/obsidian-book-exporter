# Obsidian Book Exporter

Write a book inside an Obsidian vault — one **manifest note** acts as the table of contents, each chapter / section is its own note. The plugin compiles the structure into a single manuscript and exports to **EPUB** and **PDF** via [Pandoc](https://pandoc.org).

> Desktop only. Requires `pandoc` on `$PATH` (or configure the path in settings). For PDF, [Typst](https://typst.app) is the recommended engine — single small binary, no LaTeX install needed. LaTeX engines (xelatex, tectonic) are still supported if you prefer.

## How it works

1. Open any Markdown note that you want to use as the book manifest. Put book metadata in the frontmatter, list chapters in the body — no specific tag, folder, or filename required.
2. Run **Export current book to EPUB / PDF / all formats** from the command palette.

### Example manifest

```markdown
---
title: The Context Layer
authors: [Sébastien Dubois]
language: en
publisher: DeveloPassion
description: A book about turning notes into knowledge.
cover: covers/the-context-layer.jpg
book_export:
  formats: [epub, pdf]
  pdf_engine: typst
  page_break_per_chapter: true
---

# The Context Layer

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
| Pandoc ≥ 3.x | EPUB, PDF | <https://pandoc.org/installing.html> |
| Typst (recommended PDF engine) | PDF | <https://typst.app> — single binary |
| xelatex / tectonic (alternative PDF engines) | PDF | only if you prefer LaTeX |

## Status

Pre-release. Unstable. See `documentation/plans/01-mvp.md` for the design and `documentation/history/` for the change log.

## License

MIT. See `LICENSE`.
