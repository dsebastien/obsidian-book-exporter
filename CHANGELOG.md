# Changelog

All notable changes to this project will be documented in this file.

## [0.2.2](https://github.com/dsebastien/obsidian-book-exporter/compare/0.2.1...0.2.2) (2026-07-01)

### Bug Fixes

* **all:** resolve Obsidian plugin directory scanner findings ([70b5919](https://github.com/dsebastien/obsidian-book-exporter/commit/70b5919723173f52a69eb96d89ea28e8050ac6b1))

## [0.2.1](https://github.com/dsebastien/obsidian-book-exporter/compare/0.2.0...0.2.1) (2026-06-30)

### Bug Fixes

* **changelog:** neutralise bogus @-token mention links ([#45](https://github.com/dsebastien/obsidian-book-exporter/issues/45)) ([#49](https://github.com/dsebastien/obsidian-book-exporter/issues/49)) ([7093f5a](https://github.com/dsebastien/obsidian-book-exporter/commit/7093f5a6664452d0cf0adef0f9d39e54e7da40c5))
* inline only the referenced block or section for anchored embeds ([8ba522b](https://github.com/dsebastien/obsidian-book-exporter/commit/8ba522bea6359ad26fbac41ddc13022d8a9b3b5b)), closes [Note#Heading](https://github.com/dsebastien/Note/issues/Heading) [#50](https://github.com/dsebastien/obsidian-book-exporter/issues/50) [#50](https://github.com/dsebastien/obsidian-book-exporter/issues/50)

## [0.2.0](https://github.com/dsebastien/obsidian-book-exporter/compare/0.1.0...0.2.0) (2026-06-30)

### Features

* auto-open or surface a clickable path to the exported file ([e1c0d40](https://github.com/dsebastien/obsidian-book-exporter/commit/e1c0d40e9dabfe1a355d979fa3eb4300e02cc6ae)), closes [#37](https://github.com/dsebastien/obsidian-book-exporter/issues/37)

## [0.1.0](https://github.com/dsebastien/obsidian-book-exporter/compare/0.0.8...0.1.0) (2026-06-24)

### Features

* **plugin:** add ribbon icon and context-menu export action ([#38](https://github.com/dsebastien/obsidian-book-exporter/issues/38)) ([3018fea](https://github.com/dsebastien/obsidian-book-exporter/commit/3018fea33b49655f86770de600f6e3047bc7294e))
* **plugin:** classify common pandoc Error 43 stderr ([#35](https://github.com/dsebastien/obsidian-book-exporter/issues/35)) ([f8754a1](https://github.com/dsebastien/obsidian-book-exporter/commit/f8754a1a68fc08c97047c4aa97a52a12cf381d22))
* **plugin:** expose PDF page setup options ([#40](https://github.com/dsebastien/obsidian-book-exporter/issues/40)) ([f65003c](https://github.com/dsebastien/obsidian-book-exporter/commit/f65003c31d60ab09b22dff6f0b70523d0d6a6072)), closes [#set](https://github.com/dsebastien/obsidian-book-exporter/issues/set)
* **plugin:** preflight-probe every PDF engine, not just typst ([4afa10f](https://github.com/dsebastien/obsidian-book-exporter/commit/4afa10fde029c396394eb43fd7e39faf8086f4d3))
* **plugin:** properly support weasyprint via HTML/CSS ([#36](https://github.com/dsebastien/obsidian-book-exporter/issues/36)) ([830eebd](https://github.com/dsebastien/obsidian-book-exporter/commit/830eebdb18714a120c60526a87907e6fd5bdb5cd)), closes [#29](https://github.com/dsebastien/obsidian-book-exporter/issues/29) [#40](https://github.com/dsebastien/obsidian-book-exporter/issues/40)

### Bug Fixes

* **plugin:** drop half-supported HTML PDF engines ([#36](https://github.com/dsebastien/obsidian-book-exporter/issues/36)) ([7a77eb7](https://github.com/dsebastien/obsidian-book-exporter/commit/7a77eb745f2cfa7dc088d89e8fb1ba1256f98b4f)), closes [#29](https://github.com/dsebastien/obsidian-book-exporter/issues/29)

## [0.0.8](https://github.com/dsebastien/obsidian-book-exporter/compare/0.0.7...0.0.8) (2026-06-24)

### Features

* **pdf:** full-bleed cover page for LaTeX engines ([#29](https://github.com/dsebastien/obsidian-book-exporter/issues/29)) ([#32](https://github.com/dsebastien/obsidian-book-exporter/issues/32)) ([5043fff](https://github.com/dsebastien/obsidian-book-exporter/commit/5043fffbc19214b9b6d3556fd1e0957a3fd52f9c))

### Bug Fixes

* **typst:** neutralise stray `@citations` when no bibliography is set ([#2](https://github.com/dsebastien/obsidian-book-exporter/issues/2)) ([#31](https://github.com/dsebastien/obsidian-book-exporter/issues/31)) ([e855340](https://github.com/dsebastien/obsidian-book-exporter/commit/e855340a8105e7f148bb55fd884b030ace2a67a0))

## [0.0.7](https://github.com/dsebastien/obsidian-book-exporter/compare/0.0.6...0.0.7) (2026-06-24)

### Features

* **commands:** surface validation warnings at export time ([#27](https://github.com/dsebastien/obsidian-book-exporter/issues/27)) ([#28](https://github.com/dsebastien/obsidian-book-exporter/issues/28)) ([bf774c9](https://github.com/dsebastien/obsidian-book-exporter/commit/bf774c993911205713db94b8170ae9614efc724d))
* **env:** auto-detect pandoc/typst install locations on PATH ([#9](https://github.com/dsebastien/obsidian-book-exporter/issues/9)) ([#21](https://github.com/dsebastien/obsidian-book-exporter/issues/21)) ([0429cef](https://github.com/dsebastien/obsidian-book-exporter/commit/0429cef47a1f1869c603aaa95d5155468cb9ff8e))
* **export:** report partial results when one format fails ([#7](https://github.com/dsebastien/obsidian-book-exporter/issues/7)) ([#15](https://github.com/dsebastien/obsidian-book-exporter/issues/15)) ([272a16a](https://github.com/dsebastien/obsidian-book-exporter/commit/272a16ab209d6009615b1733225d6c0e6d1ebc92))
* **pdf:** full-bleed cover page for Typst PDF exports ([#29](https://github.com/dsebastien/obsidian-book-exporter/issues/29)) ([#30](https://github.com/dsebastien/obsidian-book-exporter/issues/30)) ([9c864ad](https://github.com/dsebastien/obsidian-book-exporter/commit/9c864ade5d8b1945ae08e8122b5fd74a694edce7))
* **validator:** warn when bibliography/CSL file is missing ([#10](https://github.com/dsebastien/obsidian-book-exporter/issues/10)) ([#20](https://github.com/dsebastien/obsidian-book-exporter/issues/20)) ([38efbe3](https://github.com/dsebastien/obsidian-book-exporter/commit/38efbe39553d1d743eea2ea681cea38b2d63d006))

### Bug Fixes

* **compiler:** match video URLs by host, not anchored regex ([#23](https://github.com/dsebastien/obsidian-book-exporter/issues/23)) ([#24](https://github.com/dsebastien/obsidian-book-exporter/issues/24)) ([09523e0](https://github.com/dsebastien/obsidian-book-exporter/commit/09523e0469e1f3b8de06d2784b69c0fa4123ad2d))
* **compiler:** prevent image filename collisions in export ([#5](https://github.com/dsebastien/obsidian-book-exporter/issues/5)) ([#17](https://github.com/dsebastien/obsidian-book-exporter/issues/17)) ([dc3e51f](https://github.com/dsebastien/obsidian-book-exporter/commit/dc3e51fd1b3da06242fa25761344d027f10ac8d3))
* **compiler:** strip multi-line %% comments from exports ([#11](https://github.com/dsebastien/obsidian-book-exporter/issues/11)) ([#18](https://github.com/dsebastien/obsidian-book-exporter/issues/18)) ([f6195fb](https://github.com/dsebastien/obsidian-book-exporter/commit/f6195fb2c0a12e7e01f925549d8f6a167ff284c1))
* **exporter:** correct expandHome ~user documentation ([#8](https://github.com/dsebastien/obsidian-book-exporter/issues/8)) ([#14](https://github.com/dsebastien/obsidian-book-exporter/issues/14)) ([459e34b](https://github.com/dsebastien/obsidian-book-exporter/commit/459e34bda80b7bab5968fd6e3d39b2b0a86d2ce6))
* **log:** make the "Verbose console logging" setting actually work ([#25](https://github.com/dsebastien/obsidian-book-exporter/issues/25)) ([#26](https://github.com/dsebastien/obsidian-book-exporter/issues/26)) ([31c4e3a](https://github.com/dsebastien/obsidian-book-exporter/commit/31c4e3a6a72dc09589f5d13e3673669c79b147f0))
* **preview:** clean up preview temp dirs instead of leaking them ([#6](https://github.com/dsebastien/obsidian-book-exporter/issues/6)) ([#16](https://github.com/dsebastien/obsidian-book-exporter/issues/16)) ([bf771ea](https://github.com/dsebastien/obsidian-book-exporter/commit/bf771ea2a245bc304036c55409133b9f425229a0))

## [0.0.6](https://github.com/dsebastien/obsidian-book-exporter/compare/0.0.5...0.0.6) (2026-06-23)

### Bug Fixes

* **citations:** render Typst PDF citations via citeproc only ([#2](https://github.com/dsebastien/obsidian-book-exporter/issues/2)) ([#4](https://github.com/dsebastien/obsidian-book-exporter/issues/4)) ([6e6dffc](https://github.com/dsebastien/obsidian-book-exporter/commit/6e6dffc234c7ee8614799ee0c78d5f44224c93e9))

## [0.0.5](https://github.com/dsebastien/obsidian-book-exporter/compare/0.0.4...0.0.5) (2026-06-23)

### Bug Fixes

* **citations:** copy bibliography into temp dir so Typst PDF export resolves it ([#3](https://github.com/dsebastien/obsidian-book-exporter/issues/3)) ([3116325](https://github.com/dsebastien/obsidian-book-exporter/commit/3116325ddccd22e06e16afc3d39c5fb2b8b7b67b)), closes [#2](https://github.com/dsebastien/obsidian-book-exporter/issues/2)

## [0.0.4](https://github.com/dsebastien/obsidian-book-exporter/compare/0.0.3...0.0.4) (2026-05-18)

### Bug Fixes

* **all:** better detect typst or xelatex ([810d73e](https://github.com/dsebastien/obsidian-book-exporter/commit/810d73ef883e72fee7c290940db8410b01cb0fc0)), closes [#1](https://github.com/dsebastien/obsidian-book-exporter/issues/1)

## [0.0.3](https://github.com/dsebastien/obsidian-book-exporter/compare/0.0.2...0.0.3) (2026-05-14)

## [0.0.2](https://github.com/dsebastien/obsidian-book-exporter/compare/0.0.1...0.0.2) (2026-05-13)

## 0.0.1 (2026-04-29)

### ⚠ BREAKING CHANGES

* output paths leave the vault — OS tmpdir + absolute output

### Features

* add defaultAuthors plugin setting ([7b03622](https://github.com/dsebastien/obsidian-book-exporter/commit/7b036224e33eeded56ecc55d9758cc9498ed1479))
* apply sectionsToSkip to manifest body, expand defaults ([47546fb](https://github.com/dsebastien/obsidian-book-exporter/commit/47546fb3c6eed101b9ef3b7f1c45e785ae8eda7b))
* auto TOC depth from heading levels actually used ([206f938](https://github.com/dsebastien/obsidian-book-exporter/commit/206f93800aeb7d9462cde8b172a46c38172d9b58))
* citations via `pandoc-citeproc` (`bibliography:` frontmatter) ([2612b6e](https://github.com/dsebastien/obsidian-book-exporter/commit/2612b6e0727a6f6dcb7657cea664457b5c22c2bf))
* configurable cover frontmatter property + URL cover support ([b44234f](https://github.com/dsebastien/obsidian-book-exporter/commit/b44234f8fca6f44fa31c135b2b8925a6410828a3))
* configurable separator between inlined notes ([b69ac59](https://github.com/dsebastien/obsidian-book-exporter/commit/b69ac59503c414e31dcf8c847705f189d4ced0a1))
* configurable Typst image max-width ([ed88af4](https://github.com/dsebastien/obsidian-book-exporter/commit/ed88af496ad1d6d2275f8729bae5acc01f5e68e5)), closes [#set](https://github.com/dsebastien/obsidian-book-exporter/issues/set)
* convert standalone --- lines into manual page breaks ([8d3492e](https://github.com/dsebastien/obsidian-book-exporter/commit/8d3492e48224cd0145f15d1484289656340b3be0))
* drop required tag, add user guide ([aac764e](https://github.com/dsebastien/obsidian-book-exporter/commit/aac764e58b554a5021ae2aab7343dd82fbfc0a4b))
* front matter vs body matter via per-book section list ([662e433](https://github.com/dsebastien/obsidian-book-exporter/commit/662e4330e23db88a8170287a58cda29a5531a5d3)), closes [#set](https://github.com/dsebastien/obsidian-book-exporter/issues/set)
* opt-in `![[Note]]` embed expansion ([acf9c21](https://github.com/dsebastien/obsidian-book-exporter/commit/acf9c21c935f220381a30cc723c52d80ec20b0ef)), closes [Note#section](https://github.com/dsebastien/Note/issues/section)
* output paths leave the vault — OS tmpdir + absolute output ([a3a7cf2](https://github.com/dsebastien/obsidian-book-exporter/commit/a3a7cf29795dabdd7bd2137b244c1d8bc4b7627c))
* page breaks per chapter/part, prose in sections, smart quotes ([482fefe](https://github.com/dsebastien/obsidian-book-exporter/commit/482fefe3f62d56bb517e676b089a6a1f603f73c1))
* pre-flight binary check on plugin load ([c5f5e67](https://github.com/dsebastien/obsidian-book-exporter/commit/c5f5e6783e3ba5881d5e58956ab603fd6ded527c))
* section numbering as first-class setting ([1b9ebd5](https://github.com/dsebastien/obsidian-book-exporter/commit/1b9ebd5fc4e3b18564a96624f7271729f654ce33))
* validator flags duplicate-note references in the manifest ([4ed7806](https://github.com/dsebastien/obsidian-book-exporter/commit/4ed780634ee6b6916601021be648af0d880b10ba))

### Bug Fixes

* emit chapter page breaks as format-conditional raw blocks ([860c8e2](https://github.com/dsebastien/obsidian-book-exporter/commit/860c8e216ce3ab69821110fec93ec7911930ca1c))
* PDF export — URL embeds become links, mainfont/monofont set for Typst ([9aa5ce3](https://github.com/dsebastien/obsidian-book-exporter/commit/9aa5ce30749505a4249c027d55ebb7efb0e6eb01))











