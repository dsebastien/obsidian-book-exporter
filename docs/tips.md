---
title: Tips & best practices
nav_order: 90
---

# Tips and best practices

## Authoring

- **One file per chapter, one file per section.** That's the whole point — keep your atomic-note discipline; the manifest decides the order.
- **Don't title chapters with `# H1`.** The plugin synthesizes the chapter title from the manifest's wikilink (or its alias). A leading `# H1` in the chapter file gets dropped automatically; subsequent headings are demoted to fit. Either is fine — but knowing this avoids surprises.
- **Use aliased wikilinks to override printed chapter titles.** `[[Chapter 1 - The Problem|The Problem]]` keeps your atomic-note name precise while showing a cleaner title in the export.
- **Cover images live in the vault.** Set `cover: covers/my-book.jpg` in the manifest frontmatter (vault-relative) or use an absolute path.

## Validating before exporting

Run **Validate current book** before every long export. It catches:

- Missing `Chapters` section.
- Bullets pointing to wikilinks that don't resolve.
- Missing required metadata.

Warnings (e.g. missing `authors`) don't block. Errors do.

## Debugging a failed export

1. Toggle **Keep temporary files** on in settings.
2. Run **Preview compiled manuscript (.md)**. Inspect the merged Markdown — that's exactly what Pandoc was given.
3. If Pandoc itself failed, the Notice shows the last 20 lines of stderr. Common culprits:
    - `xelatex not found` → install a TeX distribution or switch to Typst / Tectonic.
    - `Could not find image` → an `![[image.png]]` in a chapter doesn't resolve in the vault.
    - `unknown option` → check `pandoc_extra_args` in the manifest.

## Going further

- **Per-book PDF engines.** Use `book_export.pdf_engine: typst` for one project and keep `xelatex` as the default. No need to flip global settings.
- **Per-book output folders.** Keep finalised exports next to the project: `book_export.output_dir: "30 Areas/Books/My Book/Exports"`.
- **Pandoc filters and templates.** Pass them through `book_export.pandoc_extra_args` (`--lua-filter=…`, `--template=…`). They run verbatim after the plugin's own arguments.

## Troubleshooting

### "Open the book manifest note before running this command."
The active pane is not a Markdown file. Open the manifest note, focus its tab, then re-run the command.

### EPUB has no cover
Set `cover` in the manifest frontmatter and make sure the path resolves inside the vault. Test with **Validate current book** — broken cover paths are reported.

### MOBI export fails
Verify Calibre is installed and `ebook-convert` is reachable. Run `ebook-convert --version` in a terminal; if that works, set the same path in **Settings → Calibre `ebook-convert` path**.

### TOC is too deep / too shallow
Adjust `toc_depth` per book or globally. The default (`2`) shows chapters and immediate sections.
