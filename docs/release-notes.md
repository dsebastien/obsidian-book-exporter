---
title: Release notes
nav_order: 95
---

# Release notes

This page summarises user-visible changes. The full commit history lives in [`CHANGELOG.md`](https://github.com/dsebastien/obsidian-book-exporter/blob/main/CHANGELOG.md) on GitHub.

## Unreleased

- Initial scaffold. Manuscript compilation pipeline, Pandoc runner, validator, settings tab, six commands.
- Any Markdown note can be used as a book manifest — no specific tag is required.
- EPUB and PDF supported. **Typst** is the recommended (and default) PDF engine.
- MOBI export removed. Modern Kindles + KDP accept EPUB; the cost of bundling Calibre wasn't worth it.
