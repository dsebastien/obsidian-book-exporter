# Changelog

All notable changes to this project will be documented in this file.

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
