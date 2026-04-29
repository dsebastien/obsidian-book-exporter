# Domain Model

## Entities

- **BookManifest (manifest note)** — any Markdown note whose frontmatter holds book metadata and whose body uses headings + bulleted wikilinks to declare the book's structure. No tag, folder, or naming convention is required.
- **BookMetadata** — title, authors, language, optional ISBN/publisher/cover/description/etc. Title resolution: frontmatter `title` → body `# H1` (with trailing ` (Book)` stripped) → manifest basename (with trailing ` (Book)` stripped). Authors resolution: frontmatter `authors:` → plugin `defaultAuthors` setting → `["Anonymous"]`. Cover resolution: the frontmatter key is configurable (plugin setting `coverProperty`, default `cover`); the value can be a vault-relative path, an `[[wikilink]]`, an absolute filesystem path, or an `http(s)` URL (downloaded by the exporter before pandoc runs and rewritten to a local temp path). `coverPath` always points to a local file by the time pandoc is invoked.
- **BookExportOverrides** — per-book overrides (`output_dir`, `pdf_engine`, `toc_depth`, `include_toc`, `page_break_per_chapter`, `formats`, `pandoc_extra_args`, `sections_to_skip`, `inlined_note_separator`).
- **NoteReference** — one wikilink resolved against the vault: `filePath` (vault-relative path of the target note) and `displayTitle` (alias if any, otherwise the target's basename).
- **BookSection** — one heading-driven node of the structure tree: `level` (2..6), `title`, `prose` (verbatim Markdown written directly under the heading — paragraphs, plain bullets, tables, blockquotes, code fences), ordered list of `notes` (`NoteReference[]`), and `children` (`BookSection[]`).
- **ParsedBook** — `bookNotePath`, `metadata`, `overrides`, and `sections` (the top-level `BookSection[]`).

## Body layout

The structure is a heading tree. Any heading from `## H2` to `###### H6` is a section node at the matching level. Sections nest under the most recent higher-level section. Bullets under a section that contain wikilinks contribute those wikilinks (in source order) to the section's note list. Anything else under a section (paragraphs, plain bullets, tables, blockquotes, code fences) is captured as that section's `prose` and emitted verbatim between the heading and the inlined notes.

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
- Each bullet may contain zero or more `[[wikilinks]]`. Bullets with zero wikilinks are kept as prose (they may still be meaningful list items). Bullets with one or more wikilinks contribute them in source order to the current section's note list.
- Non-bullet, non-heading lines under a section (paragraphs, tables, blockquotes, code fences) accumulate as the section's `prose`.
- Aliased wikilinks (`[[Note|Display]]`) override the linked note's basename in the inlined display title.
- Indent depth is **not** semantic at parse time — heading level is the only nesting signal. Bullets always attach to the most recently opened section.
- Code fences are skipped during parsing.
- Bullets that appear before any `## H2` are ignored (no enclosing section).

## Inlining contract

The same `sectionsToSkip` list (default: `Related`, `References`, `Title Options`, `Target Audience`) runs at two points:

- **At parse time, on the manifest body.** Any matching top-level heading and its body are removed before the heading tree is built. This lets you keep authoring scaffolding (`## Title Options`, `## Target Audience`, `## References`, `## Related`) inside the manifest without it leaking into the export.
- **At compile time, on each linked note.** Same logic, applied per inlined note so housekeeping sections like `## Related` and `## References` from atomic notes stay out of the book.

For each section, the manuscript emits, in order: the heading at the section's level, the section's `prose` (verbatim), then each inlined note, then the section's children. Empty `prose` and an empty `notes` list collapse cleanly — a heading-only section renders just its heading and nested children.

The compiler accepts an **inlined-note separator** (plugin setting + per-book `book_export.inlined_note_separator`). It controls what is emitted *between* two successive notes inside the same section:

- `none` — nothing (default; legacy run-on behaviour).
- `rule` — a Pandoc thematic-break glyph row (`* * *`). Distinct from the `---` syntax which the compiler reserves for manual page breaks.
- `blank` — an extra blank line on top of the spacing between blocks.
- `subheading` — emit each note's display title as a heading one level below the section heading (capped at H6).

When a `NoteReference` is inlined into the manuscript:

1. The note's frontmatter is stripped.
2. Configured "sections to skip" are dropped — case-insensitive heading match, fence-aware, removes the heading and its body until a same-or-higher heading.
3. The note's first `# H1` is dropped (the manifest's section title is authoritative).
4. Remaining headings are demoted to fit beneath the parent section. Offset = `parentLevel - 1`, capped at H6.
5. Obsidian-only syntax is rewritten: callouts → fenced divs, image embeds (`![[image.png]]`) → standard images (copied to `_resources/`), `[[Note]]` → display text, `%% comments %%` stripped.

`![[Note]]` (note embeds) are dropped by default. When the plugin setting `inlineNoteEmbeds` is `true`, note embeds are recursively expanded — the target note's body is inlined in place, with frontmatter stripped, configured sections-to-skip removed, the leading H1 dropped, and the body run through the same Obsidian rewriter. Recursion is bounded by `noteEmbedMaxDepth` (default 3); embeds at the depth limit fall back to their display title (alias or basename). Per-call cycle detection prevents `A → B → A` loops.

## Page breaks

If `page_break_per_chapter` is true, the compiler emits two kinds of breaks:

- **Chapter break** — a hard `\newpage` before each chapter after the first. Covers the common case (every chapter starts on a new page).
- **Part break** — a format-conditional block before each part after the first that forces the next part to start on a fresh **right-hand (recto) page**, leaving the verso blank when needed. Three raw blocks are emitted so each pandoc target picks the right one:
  - `{=typst}` → `pagebreak(to: "odd")`
  - `{=latex}` → `\cleardoublepage`
  - `{=html}` → `<div style="page-break-before: always"></div>`

The compiler decides which break to use based on the manifest's heading levels:

- `partLevel` = the **lowest-numbered** heading level present (i.e. the outermost level — typically H2).
- `chapterLevel` = the next deeper level after `partLevel`, or `partLevel` itself when the manifest is flat (only one level used).
- If `partLevel === chapterLevel`, every top-level section gets a chapter break — no part breaks. This handles flat manifests (`## Chapter 1`, `## Chapter 2`, …).
- If `partLevel !== chapterLevel`, sibling parts get part breaks; the first chapter inside a part follows the part's heading without a break, and subsequent siblings inside the same part get chapter breaks.

## Manual page breaks

Inside any inlined note's body and inside any manifest section's prose, a standalone `---` line (3+ dashes, optional surrounding whitespace) is converted into a hard `\newpage` raw block. Frontmatter is stripped before this rule runs, so the YAML opening / closing `---` are unaffected. `---` inside fenced code blocks is also left alone. This gives the author a cheap, well-known primitive for forcing a page break wherever the automatic chapter / part breaks are not enough.

## Quote rendering

The compiler injects a small Typst preamble (`#show quote.where(block: true): …`) at the top of the manuscript. It styles block quotes with a subtle left rule and italicized body, producing readable quotes in PDF output without requiring LaTeX or a custom Pandoc template. Pandoc is also called with `+smart` so straight quotes render as proper curly typographic quotes.

## Outputs

- `epub` — Pandoc with `--epub-cover-image` if a cover is present.
- `pdf` — Pandoc with `--pdf-engine=<engine>`. Engine is configurable globally + per book; default is Typst.
