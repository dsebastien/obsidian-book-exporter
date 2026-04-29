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
- **Configurable cover frontmatter property + URL covers.** A new plugin setting picks which frontmatter key holds the cover (`cover` by default, can be set to `cover_image`, `cover_url`, etc.). The value can now also be an `http(s)` URL — the plugin downloads it to the temp folder before pandoc runs.
- **Manual page breaks via `---`.** A standalone `---` line in a note body (or in a manifest section's prose) becomes a hard page break in the export. Frontmatter delimiters are stripped first; `---` inside a fenced code block is preserved.
- **Inlined-note separator** (plugin setting + per-book `book_export.inlined_note_separator`). When a manifest section bundles several notes, the compiler can now emit a visible cue between them: a centred glyph rule (`* * *`), an extra blank line, or each note's display title as a sub-heading. Default `none` preserves the previous run-on behaviour.
- **Auto TOC depth** (plugin setting, default on). The compiler derives the `--toc-depth` value from the deepest heading level actually used in the manifest — a parts-and-chapters book gets depth 3, a flat chapters-only book gets depth 2, no manual tuning needed. The static `tocDepthDefault` is now only the fallback. Per-book `book_export.toc_depth` still wins.
- **Pre-flight binary check.** On plugin load, the plugin now probes `pandoc --version` and (when the configured PDF engine is `typst`) `typst --version`. If a required binary is missing, a Notice surfaces the issue immediately instead of waiting for the user to hit Export and get a cryptic `child_process` error.
- **Opt-in note-embed expansion.** New `inlineNoteEmbeds` setting (default off, off-by-default for backwards compatibility). When enabled, `![[Note]]` embeds inside inlined notes are recursively expanded with the target note's body — frontmatter stripped, sections-to-skip applied, leading H1 dropped. A configurable `noteEmbedMaxDepth` (default 3) and per-call cycle detection keep recursion safe.
- **Typst image width.** New `typstImageWidth` setting (default `100%`). Injected as `#set image(width: <value>)` in the Typst preamble so over-sized vault images don't bleed past the page text frame in PDF exports. Accepts any Typst length (`80%`, `15cm`, etc.); empty disables the directive.
- **Front matter vs body matter.** Per-book `book_export.front_matter_sections: [Foreword, Preface, ...]` flags top-level sections as front matter. Front matter pages are numbered with lowercase roman numerals (`i`, `ii`, ...); the first non-matching top-level section starts body matter and resets numbering to arabic (`1`, `2`, ...). Implemented as format-conditional raw blocks — Typst gets `#set page(numbering: …)` + counter resets, LaTeX gets `\frontmatter` / `\mainmatter`, HTML/EPUB ignore them.
