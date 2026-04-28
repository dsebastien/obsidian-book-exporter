# Obsidian Book Exporter

Write a book inside an Obsidian vault — one **manifest note** acts as the table of contents, each chapter / section is its own note. The plugin compiles the structure into a single manuscript and exports to **EPUB** and **PDF** via [Pandoc](https://pandoc.org).

> Desktop only. Requires `pandoc` on `$PATH` (or configure the path in settings). For PDF, [Typst](https://typst.app) is the recommended engine — single small binary, no LaTeX install needed. LaTeX engines (xelatex, tectonic) are still supported if you prefer.
>
> **Configure an output folder before exporting.** Settings → Book Exporter → Default output folder: an absolute filesystem path (e.g. `~/Downloads`). The plugin refuses to export until this is set. Temp files live in the OS temp directory — never in your vault or plugin folder.

## How it works

1. Open any Markdown note that you want to use as the book manifest. Put book metadata in the frontmatter, structure the body with headings and bulleted wikilinks — no specific tag, folder, or filename required.
2. Run **Export current book to EPUB / PDF / all formats** from the command palette.

### The manifest contract

- `# H1` is the **book title** (or use `title:` in frontmatter — that wins).
- Every `## H2` … `###### H6` is a **section** at that level. Sections nest by level.
- Every bullet under a section that contains one or more `[[wikilinks]]` contributes those links — in source order — to the section. The linked notes are inlined at that point in the manuscript.
- Bullets without wikilinks are kept as part of the section's prose; text around a wikilink in a wikilink-bearing bullet is dropped (treated as author commentary).
- **Anything else under a section (paragraphs, tables, blockquotes, code fences) is kept verbatim** between the heading and the inlined notes. Lets you write `## Acknowledgments` with just a paragraph and no links.
- The structure is yours: parts → chapters → scenes, or chapters → sections, or just a flat list of chapters. The plugin doesn't care. When you mix two heading levels (parts + chapters), each new part starts on a fresh right-hand page in print, each new chapter on a new page.

### Example manifest

```markdown
---
title: The Context Layer
authors: [Sébastien Dubois]
language: en
publisher: DeveloPassion
description: A book about turning notes into knowledge.
cover: covers/the-context-layer.jpg                  # vault path, [[wikilink]], absolute path, or http(s) URL
                                                      # the frontmatter key (default `cover`) is configurable in settings
book_export:
  formats: [epub, pdf]
  pdf_engine: typst
  page_break_per_chapter: true
  sections_to_skip: [Related, References, Title Options, Target Audience]
  output_dir: "~/Books/The Context Layer"
---

# The Context Layer

## Foreword
- [[Foreword]]

## Part I — The Problem

### Chapter 1 — Why Notes Fail
- [[Why Notes Fail]]
- [[The Cost of Forgetting]]

### Chapter 2 — The Cost
- [[The Cost]]

## Part II — The Solution

### Chapter 3 — Building Context
- [[Building Context]]

## Acknowledgements
- [[Acknowledgements]]
- [[About the Author]]
```

### What gets cleaned up

When a linked note is inlined, the plugin:

- Strips its frontmatter.
- Removes configurable sections (default: `Related`, `References`, `Title Options`, `Target Audience`) — case-insensitive heading match, fence-aware. The same list is applied to the manifest body before parsing, so authoring scaffolding (`## Title Options`, `## Target Audience`, `## References`, `## Related`) stays in the manifest but never reaches the export.
- Drops the note's first `# H1` (the section title in the manifest is authoritative).
- Demotes remaining headings so they nest under the manifest section (offset = `parentLevel - 1`, capped at H6).
- Rewrites Obsidian-only syntax: callouts → fenced divs, `![[image]]` → standard Markdown images (copied to `_resources/`), `[[Note]]` → display text, `%% comments %%` stripped.

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
