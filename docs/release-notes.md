# Release Notes

## 0.2.3 (2026-07-11)

### Bug Fixes

- **plugin:** copy absolute-path image references into \_resources ([#51](https://github.com/dsebastien/obsidian-book-exporter/issues/51)) ([#52](https://github.com/dsebastien/obsidian-book-exporter/issues/52))

## 0.2.2 (2026-07-01)

### Bug Fixes

- **all:** resolve Obsidian plugin directory scanner findings

## 0.2.1 (2026-06-30)

### Bug Fixes

- **changelog:** neutralise bogus @-token mention links ([#45](https://github.com/dsebastien/obsidian-book-exporter/issues/45)) ([#49](https://github.com/dsebastien/obsidian-book-exporter/issues/49))
- inline only the referenced block or section for anchored embeds, closes [Note#Heading](https://github.com/dsebastien/Note/issues/Heading) [#50](https://github.com/dsebastien/obsidian-book-exporter/issues/50) [#50](https://github.com/dsebastien/obsidian-book-exporter/issues/50)

## 0.2.0 (2026-06-30)

### Features

- auto-open or surface a clickable path to the exported file

## 0.1.0 (2026-06-24)

### Features

- **plugin:** add ribbon icon and context-menu export action ([#38](https://github.com/dsebastien/obsidian-book-exporter/issues/38))
- **plugin:** classify common pandoc Error 43 stderr ([#35](https://github.com/dsebastien/obsidian-book-exporter/issues/35))
- **plugin:** expose PDF page setup options ([#40](https://github.com/dsebastien/obsidian-book-exporter/issues/40)), closes [#set](https://github.com/dsebastien/obsidian-book-exporter/issues/set)
- **plugin:** preflight-probe every PDF engine, not just typst
- **plugin:** properly support weasyprint via HTML/CSS ([#36](https://github.com/dsebastien/obsidian-book-exporter/issues/36)) [#40](https://github.com/dsebastien/obsidian-book-exporter/issues/40)

### Bug Fixes

- **plugin:** drop half-supported HTML PDF engines ([#36](https://github.com/dsebastien/obsidian-book-exporter/issues/36))

## 0.0.8 (2026-06-24)

### Features

- **pdf:** full-bleed cover page for LaTeX engines ([#29](https://github.com/dsebastien/obsidian-book-exporter/issues/29)) ([#32](https://github.com/dsebastien/obsidian-book-exporter/issues/32))

### Bug Fixes

- **typst:** neutralise stray `@citations` when no bibliography is set ([#2](https://github.com/dsebastien/obsidian-book-exporter/issues/2)) ([#31](https://github.com/dsebastien/obsidian-book-exporter/issues/31))

## 0.0.7 (2026-06-24)

### Features

- **commands:** surface validation warnings at export time ([#27](https://github.com/dsebastien/obsidian-book-exporter/issues/27)) ([#28](https://github.com/dsebastien/obsidian-book-exporter/issues/28))
- **env:** auto-detect pandoc/typst install locations on PATH ([#9](https://github.com/dsebastien/obsidian-book-exporter/issues/9)) ([#21](https://github.com/dsebastien/obsidian-book-exporter/issues/21))
- **export:** report partial results when one format fails ([#7](https://github.com/dsebastien/obsidian-book-exporter/issues/7)) ([#15](https://github.com/dsebastien/obsidian-book-exporter/issues/15))
- **pdf:** full-bleed cover page for Typst PDF exports ([#29](https://github.com/dsebastien/obsidian-book-exporter/issues/29)) ([#30](https://github.com/dsebastien/obsidian-book-exporter/issues/30))
- **validator:** warn when bibliography/CSL file is missing ([#10](https://github.com/dsebastien/obsidian-book-exporter/issues/10)) ([#20](https://github.com/dsebastien/obsidian-book-exporter/issues/20))

### Bug Fixes

- **compiler:** match video URLs by host, not anchored regex ([#23](https://github.com/dsebastien/obsidian-book-exporter/issues/23)) ([#24](https://github.com/dsebastien/obsidian-book-exporter/issues/24))
- **compiler:** prevent image filename collisions in export ([#5](https://github.com/dsebastien/obsidian-book-exporter/issues/5)) ([#17](https://github.com/dsebastien/obsidian-book-exporter/issues/17))
- **compiler:** strip multi-line %% comments from exports ([#11](https://github.com/dsebastien/obsidian-book-exporter/issues/11)) ([#18](https://github.com/dsebastien/obsidian-book-exporter/issues/18))
- **exporter:** correct expandHome ~user documentation ([#8](https://github.com/dsebastien/obsidian-book-exporter/issues/8)) ([#14](https://github.com/dsebastien/obsidian-book-exporter/issues/14))
- **log:** make the "Verbose console logging" setting actually work ([#25](https://github.com/dsebastien/obsidian-book-exporter/issues/25)) ([#26](https://github.com/dsebastien/obsidian-book-exporter/issues/26))
- **preview:** clean up preview temp dirs instead of leaking them ([#6](https://github.com/dsebastien/obsidian-book-exporter/issues/6)) ([#16](https://github.com/dsebastien/obsidian-book-exporter/issues/16))

## 0.0.6 (2026-06-23)

### Bug Fixes

- **citations:** render Typst PDF citations via citeproc only ([#2](https://github.com/dsebastien/obsidian-book-exporter/issues/2)) ([#4](https://github.com/dsebastien/obsidian-book-exporter/issues/4))

## 0.0.5 (2026-06-23)

### Bug Fixes

- **citations:** copy bibliography into temp dir so Typst PDF export resolves it ([#3](https://github.com/dsebastien/obsidian-book-exporter/issues/3))

## 0.0.4 (2026-05-18)

### Bug Fixes

- **all:** better detect typst or xelatex

## 0.0.3 (2026-05-14)

## 0.0.2 (2026-05-13)

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
