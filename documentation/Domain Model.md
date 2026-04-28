# Domain Model

## Entities

- **BookManifest (book note)** — a Markdown note with `tags: [type/creation/book]` whose frontmatter holds book metadata and whose body contains a structured TOC.
- **BookMetadata** — title, authors, language, optional ISBN/publisher/cover/description/etc. Title falls back to the book note's basename without ` (Book)` suffix.
- **BookExportOverrides** — per-book overrides (`output_dir`, `pdf_engine`, `toc_depth`, `include_toc`, `page_break_per_chapter`, `formats`, `pandoc_extra_args`).
- **BookEntry** — one TOC entry: a vault-relative `filePath`, a `displayTitle`, and (only for chapters) nested `sections`.
- **ParsedBook** — `bookNotePath`, `metadata`, `overrides`, and three ordered lists: `frontMatter`, `chapters`, `backMatter`.

## Body layout

The TOC is parsed from level-2 headings (configurable, defaults below) and the bulleted lists that follow them.

```
## Front Matter      ← optional
- [[Foreword]]
- [[Preface]]

## Chapters          ← required, must contain at least one bullet
- [[Chapter 1]]
  - [[Chapter 1 — Section A]]
  - [[Chapter 1 — Section B]]
- [[Chapter 2]]

## Back Matter       ← optional
- [[Acknowledgements]]
```

Rules:

- Heading names are configurable (`frontMatterHeading`, `chaptersHeading`, `backMatterHeading`).
- Each bullet must contain exactly one `[[wikilink]]`. Links with aliases (`[[Note|Display]]`) override the chapter title.
- Indent depth determines nesting: top-level bullets are chapters; nested bullets are sections of the most recent chapter.
- Bullets in `Front Matter` / `Back Matter` are flattened — nesting under those is ignored.
- Code fences are skipped during parsing.

## Outputs

- `epub` — Pandoc with `--epub-cover-image` if a cover is present.
- `pdf` — Pandoc with `--pdf-engine=<engine>`. Engine is configurable globally + per book.
- `mobi` — Calibre's `ebook-convert` from the produced EPUB.
