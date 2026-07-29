---
title: Overview
nav_order: 1
permalink: /
---

# Book Exporter

Write a book inside an Obsidian vault — one **manifest note** lists the table of contents, each chapter and section is its own note. The plugin compiles the structure into a single manuscript and exports to **EPUB** and **PDF** via [Pandoc](https://pandoc.org).

> Desktop only. Requires `pandoc` on `$PATH` — or set the path in settings. For PDF, [Typst](https://typst.app) is the recommended engine: a single small binary with output quality close to LaTeX.

## Key features

- **One note = one book.** The manifest note holds the metadata and the table of contents through wikilinks. Chapters and sections live in their own notes.
- **No required tag, folder or filename.** Any Markdown note can be used as a manifest.
- **EPUB and PDF.** Configurable PDF engine (Typst by default; xelatex / tectonic / weasyprint available).
- **Validation before export.** Missing chapters, broken wikilinks, and missing required metadata are surfaced with a clear report — no half-baked exports.
- **Per-book overrides.** A `book_export:` block in the manifest's frontmatter overrides plugin-level defaults (output folder, PDF engine, formats, TOC depth, page-break behaviour, extra Pandoc flags).
- **Page setup.** Page size, margins, line spacing, and base font size — globally or per book, translated to the right mechanism for each PDF engine.
- **Front matter & full-bleed cover.** Roman-numbered front matter with a clean reset to page 1, and a cover image that fills the first page (PDF) or becomes the EPUB cover.
- **Quick to reach.** Export from the command palette, a ribbon icon, or a note's right-click menu.
- **Manuscript preview.** A dedicated command writes the compiled `.md` and opens it — useful for checking what Pandoc will see.

## Why Pandoc?

Pandoc is the industry-standard document converter. There is no production-ready library port for JavaScript / Node, and bundling Pandoc itself is impractical (multi-platform binary, hundreds of MB). The plugin treats Pandoc as a hard prerequisite — that's the price for high-quality output. Install once, export forever.

## Quick start

1. Install the plugin (manual install or via [BRAT](https://github.com/TfTHacker/obsidian42-brat)).
2. Install [Pandoc](https://pandoc.org/installing.html). For PDF, install [Typst](https://typst.app) (recommended).
3. Open any Markdown note and structure it as a manifest (see [Usage](usage.md)).
4. Export it — from the command palette (**Book Exporter: Export current book to EPUB / PDF / all formats**), the **book ribbon icon**, or the note's **right-click menu**.

## About

Created by [Sébastien Dubois](https://dsebastien.net). Source code, issues and roadmap on [GitHub](https://github.com/dsebastien/obsidian-book-exporter).

If this plugin helps you ship a book, [buy me a coffee](https://www.buymeacoffee.com/dsebastien) ☕.

<!-- other-plugins:start -->

## My other Obsidian plugins

| Plugin                                                                                                        | What it does                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [Agentic Resource Discovery Server](https://github.com/dsebastien/obsidian-agentic-resource-discovery-server) | Local-first Agentic Resource Discovery publisher and registry that serves your AI skills and tools to agents over a local HTTP and MCP server |
| [Bookshelf Base](https://github.com/dsebastien/obsidian-bookshelf)                                            | Display your notes as a visual bookshelf via a custom Bases view                                                                              |
| [Dataview Serializer](https://github.com/dsebastien/obsidian-dataview-serializer)                             | Serialize Dataview queries to Markdown, and keep the Markdown representation up to date                                                       |
| [Expander](https://github.com/dsebastien/obsidian-expander)                                                   | Replace variables across your vault using HTML comment markers. Supports static values and dynamic functions                                  |
| [Ghost Publish](https://github.com/dsebastien/obsidian-ghost-publish)                                         | Publish your vault notes to a Ghost blog with configurable presets for tags, newsletters, and frontmatter conventions                         |
| [Graph Explorer Base View](https://github.com/dsebastien/obsidian-graph-explorer-base-view)                   | A custom Bases view that renders notes as an interactive force-directed graph with explored/unexplored tracking                               |
| [Hidden Folders Access](https://github.com/dsebastien/obsidian-hidden-folders-access)                         | Index hidden root-level folders (e.g. .claude) so they appear in the file tree, metadata cache, and Bases                                     |
| [Journal Bases](https://github.com/dsebastien/obsidian-journal-base)                                          | Custom Base views for journaling and periodic reviews                                                                                         |
| [Kanban Action Planner](https://github.com/dsebastien/obsidian-kanban-action-planner)                         | Render your notes as configurable Kanban boards and calendars inside Bases, with statuses, ordering, relationships, and scheduling            |
| [Life Tracker](https://github.com/dsebastien/obsidian-life-tracker-base-view)                                 | Capture and visualize the data that matters in your life                                                                                      |
| [Note Village](https://github.com/dsebastien/obsidian-note-village)                                           | A 2D pixel art village where your notes become villagers you can explore and chat with using AI                                               |
| [Obsidian Starter Kit](https://github.com/DeveloPassion/obsidian-starter-kit-plugin)                          | Adds strong typing support and powerful automation support for notes                                                                          |
| [Remarkable Synchronizer](https://github.com/dsebastien/obsidian-remarkable-sync)                             | Connect to the reMarkable cloud, list, download, and sync notebook pages as images                                                            |
| [Replicate](https://github.com/dsebastien/obsidian-replicate)                                                 | Use AI models with ease via the Replicate.com integration                                                                                     |
| [REST and MCP server](https://github.com/dsebastien/obsidian-cli-rest)                                        | Exposes CLI commands as RESTful API endpoints and an MCP server for AI tool integration                                                       |
| [Time Machine](https://github.com/dsebastien/obsidian-time-machine)                                           | Browse, compare, and restore previous versions of your notes using built-in file-recovery snapshots                                           |
| [Transcriber](https://github.com/dsebastien/obsidian-transcriber)                                             | Transcribe images to markdown using Ollama vision models                                                                                      |
| [Typefully](https://github.com/dsebastien/obsidian-typefully)                                                 | Publish social media posts with ease using the Typefully integration                                                                          |
| [Update Time](https://github.com/dsebastien/obsidian-update-time)                                             | Automatically update front matter to include creation and last update times                                                                   |

Everything I build is documented in [my newsletter](https://dsebastien.net/newsletter) and on [my YouTube channel](https://youtube.com/@dsebastien).

<!-- other-plugins:end -->

<!-- support-cta -->

## News & support

To stay up to date about this plugin, Obsidian in general, Personal Knowledge Management and note-taking:

- Subscribe to [my newsletter](https://dsebastien.net/newsletter)
- Subscribe to [my YouTube channel](https://youtube.com/@dsebastien)
- Join the [Knowii community](https://www.store.dsebastien.net/product/knowii-community/) and learn to organize your notes and put your knowledge to work, together with fellow knowledge workers

If this plugin is useful to you, here are the best ways to support my work ❤️:

- [Join the Knowii community](https://www.store.dsebastien.net/product/knowii-community/)
- [Become a GitHub Sponsor](https://github.com/sponsors/dsebastien)
- [Buy me a coffee](https://www.buymeacoffee.com/dsebastien)
- [Subscribe to my YouTube channel](https://youtube.com/@dsebastien)
- [Check out my products](https://store.dsebastien.net)
