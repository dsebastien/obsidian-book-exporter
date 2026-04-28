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
  sections_to_skip: [Related, References]
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
- Bullets without wikilinks are ignored. Text around a wikilink is treated as commentary and dropped.
- Code fences are skipped during parsing.
- The structure is yours. Parts/chapters, chapters/sections, just chapters — anything as long as the heading hierarchy is consistent.

### Frontmatter metadata

| Field | Required | Notes |
|-------|----------|-------|
| `title` | recommended | Falls back to the body H1, then the manifest's basename (`(Book)` suffix stripped). |
| `authors` | recommended | String or list. Falls back to `Anonymous`. |
| `language` | optional | BCP-47 (`en`, `fr`). Default `en`. |
| `publisher` | optional | |
| `date_published` | optional | |
| `description` | optional | |
| `isbn` | optional | Set as the EPUB identifier. |
| `cover` | optional | Vault-relative or absolute image path. Used as the EPUB cover. |
| `subject` | optional | Single string or list. |
| `rights` | optional | Copyright statement. |
| `book_export` | optional | Per-book overrides — see [Configuration](configuration.md). |

## Commands

| Command | What it does |
|---------|--------------|
| Export current book to EPUB | Compiles the manuscript and runs Pandoc → EPUB. |
| Export current book to PDF | Compiles the manuscript and runs Pandoc with the configured PDF engine. |
| Export current book to all formats | Runs every format listed in `book_export.formats`, falling back to the plugin default. |
| Preview compiled manuscript (.md) | Writes the merged Markdown to the temp directory and opens it. Useful when an export fails — you see exactly what Pandoc was given. |
| Validate current book | Parses the manifest, runs the validator, and shows a report (no sections, broken wikilinks, etc.). No export. |
| Open exports folder | Reveals the configured output folder in the OS file manager. |

## What the compiler does

1. Walks the heading tree from the manifest. Each section is rendered at its level; its linked notes are inlined in source order.
2. For each linked note:
   - Strips frontmatter.
   - Removes configured **sections to skip** (default: `Related`, `References`) — case-insensitive heading match, fence-aware.
   - Drops the first `# H1` (the section title from the manifest is authoritative).
   - Demotes remaining headings to fit beneath the current manifest section (offset = `parentLevel - 1`, capped at H6).
   - Rewrites Obsidian-only syntax: callouts → fenced divs, image embeds (`![[…]]`) → standard Markdown images, note references (`[[Note]]`) → display text, `%% comments %%` stripped.
3. Copies referenced images into a `_resources/` folder next to the manuscript.
4. Inserts a hard page break before each top-level section if **page break per chapter** is enabled. "Top-level" = the lowest-numbered heading level used in the manifest (so it works whether you start at H2 or use H2 for parts and H3 for chapters).
5. Hands the result to Pandoc with a generated YAML metadata file (avoids escaping issues with non-ASCII titles).
