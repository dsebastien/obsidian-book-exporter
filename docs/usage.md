---
title: Usage
nav_order: 2
---

# Usage

## The manifest note

Any Markdown note can be a book manifest. Put metadata in the frontmatter, structure the body with headings and bulleted wikilinks. **No specific tag, folder or filename is required.**

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
    sections_to_skip: [Related, References, Title Options, Target Audience]
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

### Body contract

- `# H1` is the book title. The frontmatter `title` wins if both are present. The basename is the last fallback.
- Every `## H2` … `###### H6` becomes a **section** at the matching level. Sections nest under the previous higher-level section.
- Every bullet under a section that contains one or more `[[wikilinks]]` adds those links — in source order — to the section's note list.
- Bullets that contain no wikilinks are treated as prose. Text around a wikilink in a wikilink-bearing bullet is commentary and dropped.
- **Other content under a section (paragraphs, plain bullets, tables, blockquotes, code fences) is kept verbatim** and emitted between the section heading and its inlined notes. Useful for sections that don't link out — `## Acknowledgments` followed by a thank-you paragraph just works.
- **A standalone `---` line (a Markdown thematic break) becomes a page break** — both inside an inlined note and inside the manifest's section prose. This is the manual page-break primitive: drop a `---` wherever you want a forced page break, on top of the automatic chapter / part breaks. (YAML frontmatter delimiters are stripped before this rule fires, so the opening / closing `---` of a frontmatter block are unaffected. `---` inside a fenced code block is also left alone.)
- Code fences are passed through unchanged.
- The structure is yours. Parts/chapters, chapters/sections, just chapters — anything as long as the heading hierarchy is consistent.

### Frontmatter metadata

| Field            | Required    | Notes                                                                                                                                                                                                                                      |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`          | recommended | Falls back to the body H1, then the manifest's basename (`(Book)` suffix stripped).                                                                                                                                                        |
| `authors`        | recommended | String or list. Falls back to the plugin's **Default author(s)** setting, then to `Anonymous`.                                                                                                                                             |
| `language`       | optional    | BCP-47 (`en`, `fr`). Default `en`.                                                                                                                                                                                                         |
| `publisher`      | optional    |                                                                                                                                                                                                                                            |
| `date_published` | optional    |                                                                                                                                                                                                                                            |
| `description`    | optional    |                                                                                                                                                                                                                                            |
| `isbn`           | optional    | Set as the EPUB identifier.                                                                                                                                                                                                                |
| `cover`          | optional    | Vault-relative or absolute image path, an `[[wikilink]]`, or an `http(s)` URL (downloaded automatically). Used as the EPUB cover. The frontmatter key name is configurable in **Settings → Note processing → Cover frontmatter property**. |
| `subject`        | optional    | Single string or list.                                                                                                                                                                                                                     |
| `rights`         | optional    | Copyright statement.                                                                                                                                                                                                                       |
| `bibliography`   | optional    | Vault-relative path, absolute path, or `[[wikilink]]` of a bibliography file (`.bib`, `.json`, `.yaml`). When set, citations like `[@smith2020]` in your notes are resolved by `pandoc-citeproc`.                                          |
| `csl`            | optional    | Vault-relative path, absolute path, or `[[wikilink]]` of a CSL stylesheet — controls citation rendering style. Pandoc has a usable default.                                                                                                |
| `book_export`    | optional    | Per-book overrides — see [Configuration](configuration.md).                                                                                                                                                                                |

## Commands

| Command                            | What it does                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Export current book to EPUB        | Compiles the manuscript and runs Pandoc → EPUB.                                                                                     |
| Export current book to PDF         | Compiles the manuscript and runs Pandoc with the configured PDF engine.                                                             |
| Export current book to all formats | Runs every format listed in `book_export.formats`, falling back to the plugin default.                                              |
| Preview compiled manuscript (.md)  | Writes the merged Markdown to the temp directory and opens it. Useful when an export fails — you see exactly what Pandoc was given. |
| Validate current book              | Parses the manifest, runs the validator, and shows a report (no sections, broken wikilinks, etc.). No export.                       |
| Open exports folder                | Reveals the configured output folder in the OS file manager.                                                                        |

## What the compiler does

1. Walks the heading tree from the manifest. Each section is rendered at its level; its linked notes are inlined in source order.
2. **First** the manifest body itself is filtered: any top-level section whose heading matches an entry in **sections to skip** (case-insensitive) is dropped before parsing. This lets you keep authoring scaffolding (`## Title Options`, `## Target Audience`, `## References`, `## Related`) inside the manifest without polluting the export.
3. For each linked note:
    - Strips frontmatter.
    - Removes the same configured **sections to skip** (default: `Related`, `References`, `Title Options`, `Target Audience`) — case-insensitive heading match, fence-aware.
    - Drops the first `# H1` (the section title from the manifest is authoritative).
    - Demotes remaining headings to fit beneath the current manifest section (offset = `parentLevel - 1`, capped at H6).
    - Converts standalone `---` lines (thematic breaks) into hard page breaks (`\newpage`) — fence-aware. Frontmatter has already been stripped, so YAML delimiters never reach this step.
    - Rewrites Obsidian-only syntax: callouts → fenced divs, image embeds (`![[…]]`) → standard Markdown images, note references (`[[Note]]`) → display text, `%% comments %%` stripped.
4. Copies referenced images into a `_resources/` folder next to the manuscript.
5. Inserts page breaks when **page break per chapter** is enabled:
    - Each chapter starts on a new page (`\newpage`).
    - When the manifest uses two heading levels (e.g. H2 = parts, H3 = chapters), each new part starts on a fresh **right-hand (recto) page** — leaving the verso blank when needed. Implemented via format-conditional raw blocks: Typst `pagebreak(to: "odd")`, LaTeX `\cleardoublepage`, EPUB CSS `page-break-before: always`.
6. Injects a small Typst preamble that styles block quotes (left rule, italicized body) so quotes render cleanly in PDF without LaTeX. Pandoc's `+smart` reader extension also turns straight quotes into curly quotes throughout.
7. Hands the result to Pandoc with a generated YAML metadata file (avoids escaping issues with non-ASCII titles).
