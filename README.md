# Obsidian Book Exporter

Write a book inside an Obsidian vault — one **manifest note** acts as the table of contents, each chapter / section is its own note. The plugin compiles the structure into a single manuscript and exports to **EPUB** and **PDF** via [Pandoc](https://pandoc.org).

> Desktop only. Requires `pandoc` on `$PATH` (or configure the path in settings). For PDF, [Typst](https://typst.app) is the recommended engine — single small binary, no LaTeX install needed. LaTeX engines (xelatex, tectonic) are still supported if you prefer.
>
> **Configure an output folder before exporting.** Settings → Book Exporter → Default output folder: an absolute filesystem path (e.g. `~/Downloads`). The plugin refuses to export until this is set. Temp files live in the OS temp directory — never in your vault or plugin folder.

## How it works

1. Open any Markdown note that you want to use as the book manifest. Put book metadata in the frontmatter, structure the body with headings and bulleted wikilinks — no specific tag, folder, or filename required.
2. Run **Export current book to EPUB / PDF / all formats** from the command palette.

### The manifest contract

- `# H1` is the **book title** (or use `title:` in frontmatter — that wins).
- Every `## H2` … `###### H6` is a **section** at that level. Sections nest by level.
- Every bullet under a section that contains one or more `[[wikilinks]]` contributes those links — in source order — to the section. The linked notes are inlined at that point in the manuscript.
- Bullets without wikilinks are kept as part of the section's prose; text around a wikilink in a wikilink-bearing bullet is dropped (treated as author commentary).
- **Anything else under a section (paragraphs, tables, blockquotes, code fences) is kept verbatim** between the heading and the inlined notes. Lets you write `## Acknowledgments` with just a paragraph and no links.
- The structure is yours: parts → chapters → scenes, or chapters → sections, or just a flat list of chapters. The plugin doesn't care. When you mix two heading levels (parts + chapters), each new part starts on a fresh right-hand page in print, each new chapter on a new page.
- A standalone `---` line in any note's body (or in the manifest's section prose) is converted to a hard page break. Use it to force a page break wherever the automatic chapter / part breaks aren't enough. (YAML frontmatter delimiters are stripped first; `---` inside a fenced code block is left alone.)

### Example manifest

```markdown
---
title: The Context Layer
authors: [Sébastien Dubois]
language: en
publisher: DeveloPassion
description: A book about turning notes into knowledge.
cover:
    covers/the-context-layer.jpg # vault path, [[wikilink]], absolute path, or http(s) URL
    # the frontmatter key (default `cover`) is configurable in settings
    # used as the EPUB cover and as a full-bleed first page in PDFs (Typst, xelatex, tectonic)
book_export:
    formats: [epub, pdf]
    pdf_engine: typst
    page_break_per_chapter: true
    sections_to_skip: [Related, References, Title Options, Target Audience]
    output_dir: '~/Books/The Context Layer'
    # PDF page setup (all optional; per-engine translation, settings provide defaults)
    page_size: a4 # a4, us-letter, a5, legal, …
    margin: 2cm # uniform page margin (with unit)
    line_spacing: 1.5 # unitless multiple
    base_font_size: 11pt # bare numbers get `pt` appended
---

# The Context Layer

## Foreword

- [[Foreword]]

## Part I — The Problem

### Chapter 1 — Why Notes Fail

- [[Why Notes Fail]]
- [[The Cost of Forgetting]]

### Chapter 2 — The Cost

- [[The Cost]]

## Part II — The Solution

### Chapter 3 — Building Context

- [[Building Context]]

## Acknowledgements

- [[Acknowledgements]]
- [[About the Author]]
```

### What gets cleaned up

When a linked note is inlined, the plugin:

- Strips its frontmatter.
- Removes configurable sections (default: `Related`, `References`, `Title Options`, `Target Audience`) — case-insensitive heading match, fence-aware. The same list is applied to the manifest body before parsing, so authoring scaffolding (`## Title Options`, `## Target Audience`, `## References`, `## Related`) stays in the manifest but never reaches the export.
- Drops the note's first `# H1` (the section title in the manifest is authoritative).
- Demotes remaining headings so they nest under the manifest section (offset = `parentLevel - 1`, capped at H6).
- Rewrites Obsidian-only syntax: callouts → fenced divs, `![[image]]` → standard Markdown images (copied to `_resources/`), `[[Note]]` → display text, `%% comments %%` stripped (including multi-line comments; `%%` inside code fences is preserved).

### Output files

Each export is written to your configured output folder as `<title-slug>_<YYYY-MM-DD>.<ext>` — e.g. `the-context-layer_2026-06-23.pdf`. The date is the export day, so:

- **Re-exporting the same book on the same day overwrites the previous file** (intentional — keeps the folder tidy while you iterate).
- Exporting on a different day produces a new dated file alongside the old one.

If a multi-format export partially fails (e.g. EPUB succeeds but PDF can't find its engine), the successful formats are still written and the notice reports exactly which format failed and why.

## Commands

- `Book Exporter: Export current book to EPUB`
- `Book Exporter: Export current book to PDF`
- `Book Exporter: Export current book to all formats`
- `Book Exporter: Preview compiled manuscript (.md)`
- `Book Exporter: Validate current book`
- `Book Exporter: Open exports folder`

## Installation

### Community plugins (recommended)

1. In Obsidian, go to **Settings → Community plugins**.
2. Disable **Restricted mode** if it's enabled.
3. Select **Browse**, search for **Book Exporter**, install it, then enable it.

You can also browse the catalog on the [Obsidian Community](https://community.obsidian.md/) website.

### Manual installation

If the plugin isn't listed in the community catalog yet (or you want a specific version):

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dsebastien/obsidian-book-exporter/releases).
2. Copy them into `<Vault>/.obsidian/plugins/book-exporter/`.
3. Reload Obsidian and enable **Book Exporter** in **Settings → Community plugins**.

### BRAT (bleeding edge)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) installs plugins straight from a GitHub repo and keeps them updated automatically. Use this if you want the latest commits — **things might break**.

1. Install **Obsidian42 - BRAT** from **Settings → Community plugins → Browse** and enable it.
2. Run **BRAT: Add a beta plugin for testing** from the command palette.
3. Paste `https://github.com/dsebastien/obsidian-book-exporter`.
4. Select the latest version and confirm.
5. Enable **Book Exporter** in **Settings → Community plugins**.

## Development setup

### From source

```bash
git clone https://github.com/dsebastien/obsidian-book-exporter.git
cd obsidian-book-exporter
bun install
export OBSIDIAN_VAULT_LOCATION="/path/to/your/vault"
bun run dev
```

The dev build copies the plugin into `<vault>/.obsidian/plugins/book-exporter/` automatically and writes a `.hotreload` marker for the [Hot Reload](https://github.com/pjeby/hot-reload) plugin.

## External tools

| Tool                                         | Required for | Install                              |
| -------------------------------------------- | ------------ | ------------------------------------ |
| Pandoc ≥ 3.x                                 | EPUB, PDF    | <https://pandoc.org/installing.html> |
| Typst (recommended PDF engine)               | PDF          | <https://typst.app> — single binary  |
| xelatex / tectonic (alternative PDF engines) | PDF          | only if you prefer LaTeX             |

### macOS: "pandoc not found" / "typst not found" / "xelatex not found"

Obsidian on macOS is an Electron GUI app launched from Finder or the dock, which means it starts with a **stripped `$PATH`** (typically only `/usr/bin:/bin:/usr/sbin:/sbin`). Even when `pandoc`, `typst`, or `xelatex` work fine from Terminal, the plugin's spawned process won't see them.

The plugin **auto-detects the usual install locations** (`/opt/homebrew/bin`, `/usr/local/bin`, `/opt/local/bin`, `/Library/TeX/texbin`, `/usr/bin`, `/bin`) and adds the ones that exist to the spawned process's `$PATH`, so a standard Homebrew or MacTeX install usually works with no configuration. If your tools live somewhere non-standard, the settings below still let you point at them explicitly (and your `Extra PATH directories` always take priority over the auto-detected ones):

- **Settings → Book Exporter → Pandoc path** — full path to the pandoc binary (e.g. `/usr/local/bin/pandoc` or `/opt/homebrew/bin/pandoc`).
- **Settings → Book Exporter → PDF engine path** — full path to the PDF engine (e.g. `/opt/homebrew/bin/typst` or `/Library/TeX/texbin/xelatex`). Forwarded to pandoc as `--pdf-engine=<path>`, so pandoc doesn't have to resolve the engine via `$PATH`.
- **Settings → Book Exporter → Extra PATH directories** — colon-separated list of directories prepended to `$PATH` for the spawned pandoc process. Lets pandoc resolve its own helper binaries (`typst`, LaTeX packages, image converters, …) without setting each path individually. Example: `/opt/homebrew/bin:/Library/TeX/texbin:/usr/local/bin`.

## Troubleshooting

Exports run `pandoc` (and a PDF engine) as a child process. When something fails, the plugin shows a Notice with the failing format and the **tail of the engine's stderr** — that text is the real diagnosis. Open the developer console (**Ctrl/Cmd-Shift-I**) for the full output, and enable **Settings → Book Exporter → Verbose console logging** for the exact command line.

### "Error 43" or an export that fails with no obvious reason

`Error 43` is Typst's generic compilation-failure code — it is *not* the cause, just the exit status. The real message is in the lines above it in the console / Notice (e.g. a missing font, an unfetchable image, or a malformed table). Read the stderr tail first; almost every failure below shows up there.

### "font fallback list must not be empty" / fonts look wrong

Pandoc 3.6+ with the Typst engine **requires** a main font. If **Settings → Book Exporter → PDF main font** is empty (or names a font not installed on this machine), Typst aborts with `font fallback list must not be empty`.

- Set **PDF main font** and **PDF mono font** to fonts that exist on the host. Run `typst fonts` to list what Typst can see — e.g. `Liberation Serif`, `New Computer Modern`, `Noto Serif` (body) and `Liberation Mono`, `DejaVu Sans Mono` (code).
- Per book, override with `book_export.pandoc_extra_args: ['-V', 'mainfont=...']` — explicit args always win over the settings defaults.

### "pandoc not found" / "typst not found" / "xelatex not found"

The plugin couldn't launch the binary. Install the tool (see [External tools](#external-tools)), then make sure the plugin can find it:

- Confirm it runs from a terminal (`pandoc --version`, `typst --version`).
- On macOS, Obsidian launches with a stripped `$PATH` — see [macOS PATH issue](#macos-pandoc-not-found--typst-not-found--xelatex-not-found) for auto-detection and the explicit path settings.
- On any OS you can set **Pandoc path**, **PDF engine path**, and **Extra PATH directories** in settings to point at the binaries directly.

### Citations render as raw `@tokens` or the reference list is missing

Citations are enabled automatically when the manifest frontmatter has a `bibliography:` field. Pandoc's citeproc then resolves `[@smith2020]`-style keys and appends a reference list.

- `bibliography:` accepts a **`.bib`, `.json`, or `.yaml`** file (BibLaTeX or CSL-JSON/YAML), given as a vault-relative path, an absolute path, or an Obsidian `[[wikilink]]`. URLs are **not** supported — citation files must be local.
- Add `csl:` (same path forms) to pick a citation style; pandoc has a sensible default otherwise.
- If a `@token` shows up as literal text, that key wasn't found in the bibliography (or there is no `bibliography:` at all). With **no** bibliography, stray `@tokens` are intentionally rendered as plain text rather than failing the export — so check the key spelling and that the file resolves.

### Images don't appear

- **Local images** embedded with `![[image.png]]` are copied into the manuscript's `_resources/` folder and inlined automatically. Make sure the embed resolves in Obsidian first.
- **Remote (`http(s)`) images** in note bodies can't be fetched by the Typst engine and would abort the export, so they're converted to a plain link instead of an inline image. Download the image into your vault and embed it locally if you need it printed.
- The **cover** is the exception: `cover:` accepts an `http(s)` URL and is downloaded to the temp dir before pandoc runs.

## Status

Pre-release. Unstable. See `documentation/plans/01-mvp.md` for the design and `documentation/history/` for the change log.

## License

MIT. See `LICENSE`.
