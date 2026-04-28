# Domain Model

## Entities

- **BookManifest (manifest note)** — any Markdown note whose frontmatter holds book metadata and whose body uses headings + bulleted wikilinks to declare the book's structure. No tag, folder, or naming convention is required.
- **BookMetadata** — title, authors, language, optional ISBN/publisher/cover/description/etc. Title resolution: frontmatter `title` → body `# H1` (with trailing ` (Book)` stripped) → manifest basename (with trailing ` (Book)` stripped).
- **BookExportOverrides** — per-book overrides (`output_dir`, `pdf_engine`, `toc_depth`, `include_toc`, `page_break_per_chapter`, `formats`, `pandoc_extra_args`, `sections_to_skip`).
- **NoteReference** — one wikilink resolved against the vault: `filePath` (vault-relative path of the target note) and `displayTitle` (alias if any, otherwise the target's basename).
- **BookSection** — one heading-driven node of the structure tree: `level` (2..6), `title`, ordered list of `notes` (`NoteReference[]`), and `children` (`BookSection[]`).
- **ParsedBook** — `bookNotePath`, `metadata`, `overrides`, and `sections` (the top-level `BookSection[]`).

## Body layout

The structure is a heading tree. Any heading from `## H2` to `###### H6` is a section node at the matching level. Sections nest under the most recent higher-level section. Bullets under a section that contain wikilinks contribute those wikilinks (in source order) to the section's note list.

```
# The Context Layer        ← optional body title (or use frontmatter `title`)

## Foreword                ← H2 section
- [[Foreword]]

## Part I — The Problem    ← H2 section
### Chapter 1              ← H3 nested under Part I
- [[Why Notes Fail]]
- [[The Cost of Forgetting]]
### Chapter 2
- [[The Cost]]

## Part II — The Solution
### Chapter 3
- [[Building Context]]

## Acknowledgements
- [[Acknowledgements]]
- [[About the Author]]
```

Rules:

- The first `# H1` (if any) sets the body title and is otherwise ignored. The frontmatter `title` wins if both are present.
- Each bullet may contain zero or more `[[wikilinks]]`. Bullets with zero wikilinks are ignored. Bullets with one or more wikilinks contribute them in source order to the current section.
- Aliased wikilinks (`[[Note|Display]]`) override the linked note's basename in the inlined display title.
- Indent depth is **not** semantic at parse time — heading level is the only nesting signal. Bullets always attach to the most recently opened section.
- Code fences are skipped during parsing.
- Bullets that appear before any `## H2` are ignored (no enclosing section).

## Inlining contract

When a `NoteReference` is inlined into the manuscript:

1. The note's frontmatter is stripped.
2. Configured "sections to skip" (default: `Related`, `References`) are dropped — case-insensitive heading match, fence-aware, removes the heading and its body until a same-or-higher heading.
3. The note's first `# H1` is dropped (the manifest's section title is authoritative).
4. Remaining headings are demoted to fit beneath the parent section. Offset = `parentLevel - 1`, capped at H6.
5. Obsidian-only syntax is rewritten: callouts → fenced divs, image embeds (`![[image.png]]`) → standard images (copied to `_resources/`), `[[Note]]` → display text, `%% comments %%` stripped.

## Page breaks

If `page_break_per_chapter` is true, a hard page break (`\newpage`) is inserted before each top-level section after the first. "Top-level" = the lowest-numbered heading level present in the manifest. So a book that uses H2 for parts and H3 for chapters page-breaks per part; a book that uses only H2 page-breaks per H2.

## Outputs

- `epub` — Pandoc with `--epub-cover-image` if a cover is present.
- `pdf` — Pandoc with `--pdf-engine=<engine>`. Engine is configurable globally + per book; default is Typst.
