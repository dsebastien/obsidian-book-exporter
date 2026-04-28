---
title: Release notes
nav_order: 95
---

# Release notes

This page summarises user-visible changes. The full commit history lives in [`CHANGELOG.md`](https://github.com/dsebastien/obsidian-book-exporter/blob/main/CHANGELOG.md) on GitHub.

## Unreleased

- Initial scaffold. Manuscript compilation pipeline, Pandoc runner, validator, settings tab, six commands.
- Any Markdown note can be used as a book manifest — no specific tag is required.
- **Manifest contract is heading-driven.** `# H1` is the title; `## H2` … `###### H6` are sections at that level; bullets with wikilinks contribute notes (in order) to the current section. No reserved heading names — the structure is yours.
- **Sections to skip** (default: `Related`, `References`, `Title Options`, `Target Audience`) — applied to both the manifest body before parsing (so authoring scaffolding stays in the manifest but never reaches the export) and to each linked note when inlining (so housekeeping headings stay out of the published book). One unified setting, configurable globally and per book.
- **Default author(s)** plugin setting — fills in when a manifest doesn't define `authors:` in its frontmatter, before falling back to `Anonymous`.
- **Output goes to an absolute filesystem path now**, not the vault. Configure **Default output folder** in settings (e.g. `~/Downloads`); `~` is expanded. Per-book `book_export.output_dir` follows the same rules. The plugin refuses to export until configured.
- **Temp files live in the OS temp directory** (e.g. `/tmp/obsidian-book-exporter-<book>-<random>/` on Linux), never inside the vault or plugin folder. Auto-cleaned after each export.
- EPUB and PDF supported. **Typst** is the recommended (and default) PDF engine.
- MOBI export removed. Modern Kindles + KDP accept EPUB; the cost of bundling Calibre wasn't worth it.
- **Sections include their prose, not just their links.** Any text written directly under a manifest section (paragraphs, plain bullets, tables, blockquotes, code fences) is kept verbatim and emitted between the section heading and its inlined notes. Lets you write `## Acknowledgments` with a paragraph and no wikilinks and have it show up in the book.
- **Page breaks per chapter and blank page before each part.** Chapters get a hard page break (`\newpage`); parts get a format-conditional page break that forces a recto (right-hand) start in print — `pagebreak(to: "odd")` for Typst, `\cleardoublepage` for LaTeX, CSS `page-break-before: always` for EPUB. Triggered automatically when the manifest mixes two heading levels (e.g. H2 = parts, H3 = chapters).
- **Curly quotes and improved blockquote styling.** Pandoc's `+smart` extension turns straight quotes into typographic curly quotes. A small Typst preamble shipped with each export styles block quotes with a left rule and italicized body — readable, professional, no LaTeX needed.
