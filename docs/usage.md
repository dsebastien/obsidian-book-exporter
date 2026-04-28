---
title: Usage
nav_order: 2
---

# Usage

## The manifest note

Any Markdown note can be a book manifest. Put the metadata in frontmatter, list the chapters in the body.

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

### Body rules

- The plugin looks for three configurable level-2 headings: **Front Matter**, **Chapters**, **Back Matter**. You can rename any of them in settings.
- Under each heading, every bullet must contain exactly one `[[wikilink]]`. Aliased links (`[[Note|Display]]`) override the chapter title.
- **Order matters** — the manuscript is built in the order bullets appear.
- Indentation under **Chapters** defines section nesting: top-level bullets are chapters, nested bullets are sections of the most recent chapter.
- Bullets in **Front Matter** and **Back Matter** are flattened — nesting under those is ignored.
- Anything else in the manifest body (intro paragraphs, references, internal notes) is ignored by the exporter.

### Frontmatter metadata

| Field | Required | Notes |
|-------|----------|-------|
| `title` | recommended | Falls back to the manifest's basename. |
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
| Validate current book | Parses the manifest, runs the validator, and shows a report (missing chapters, broken wikilinks, etc.). No export. |
| Open exports folder | Reveals the configured output folder in the OS file manager. |

## What the compiler does

1. Reads every chapter / section note linked from the manifest.
2. Strips each note's frontmatter.
3. Drops the first `# H1` of each note (the chapter title is synthesized from the manifest's wikilink).
4. Demotes remaining headings — chapters' headings shift by one level, sections' by two.
5. Rewrites Obsidian-only syntax: callouts → fenced divs, image embeds (`![[…]]`) → standard images, note references (`[[Note]]`) → plain text, `%% comments %%` are stripped.
6. Copies referenced images into a `_resources/` folder next to the manuscript.
7. Hands the result to Pandoc with a generated YAML metadata file (avoids escaping issues with non-ASCII titles).
