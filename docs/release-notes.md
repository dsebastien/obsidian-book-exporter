# Release Notes

## 0.0.1 (2026-04-29)

### ⚠ BREAKING CHANGES

- output paths leave the vault — OS tmpdir + absolute output

### Features

- add defaultAuthors plugin setting
- apply sectionsToSkip to manifest body, expand defaults
- auto TOC depth from heading levels actually used
- citations via `pandoc-citeproc` (`bibliography:` frontmatter)
- configurable cover frontmatter property + URL cover support
- configurable separator between inlined notes
- configurable Typst image max-width, closes [#set](https://github.com/dsebastien/obsidian-book-exporter/issues/set)
- convert standalone --- lines into manual page breaks
- drop required tag, add user guide
- front matter vs body matter via per-book section list, closes [#set](https://github.com/dsebastien/obsidian-book-exporter/issues/set)
- opt-in `![[Note]]` embed expansion, closes [Note#section](https://github.com/dsebastien/Note/issues/section)
- output paths leave the vault — OS tmpdir + absolute output
- page breaks per chapter/part, prose in sections, smart quotes
- pre-flight binary check on plugin load
- section numbering as first-class setting
- validator flags duplicate-note references in the manifest

### Bug Fixes

- emit chapter page breaks as format-conditional raw blocks
- PDF export — URL embeds become links, mainfont/monofont set for Typst
