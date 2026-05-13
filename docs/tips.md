---
title: Tips & best practices
nav_order: 90
---

# Tips and best practices

## Authoring

- **One file per chapter, one file per section.** That's the whole point — keep your atomic-note discipline; the manifest decides the order.
- **The manifest's heading hierarchy is yours.** Use H2 for chapters in a flat book, or H2 for parts + H3 for chapters in a structured one. The plugin parses whatever you write and demotes inlined notes to fit underneath.
- **Don't title chapters with `# H1`.** The section title in the manifest is authoritative. A leading `# H1` in the inlined note is dropped automatically; subsequent headings are demoted. Either is fine — knowing this avoids surprises.
- **Multiple wikilinks per bullet are allowed.** `- [[Note A]] [[Note B]]` inlines both, in order, under the current section. Useful for grouping a small number of related notes.
- **Use the `sections_to_skip` config** (`Related`, `References` by default) so housekeeping sections in your atomic notes don't appear in the published book.
- **Cover images live in the vault.** Set `cover: covers/my-book.jpg` in the manifest frontmatter (vault-relative) or use an absolute path.

## Validating before exporting

Run **Validate current book** before every long export. It catches:

- No sections in the manifest body.
- Bullets pointing to wikilinks that don't resolve.
- Missing required metadata.

Warnings (e.g. missing `authors`) don't block. Errors do.

## Debugging a failed export

1. Toggle **Keep temporary files** on in settings.
2. Run **Preview compiled manuscript (.md)**. Inspect the merged Markdown — that's exactly what Pandoc was given.
3. If Pandoc itself failed, the Notice shows the last 20 lines of stderr. Common culprits:
    - `pandoc not found` → install Pandoc or set the binary path in settings.
    - `typst not found` → install [Typst](https://typst.app), or switch the engine to one already on your system.
    - `Could not find image` → an `![[image.png]]` in a chapter doesn't resolve in the vault.
    - `unknown option` → check `pandoc_extra_args` in the manifest.

## Going further

- **Per-book PDF engines.** `book_export.pdf_engine: typst` for one project, `xelatex` for another. No need to flip global settings.
- **Per-book output folders.** Keep finalised exports next to the project: `book_export.output_dir: "30 Areas/Books/My Book/Exports"`.
- **Pandoc filters and templates.** Pass them through `book_export.pandoc_extra_args` (`--lua-filter=…`, `--template=…`). They run verbatim after the plugin's own arguments.

## Troubleshooting

### "Open the book manifest note before running this command."

The active pane is not a Markdown file. Open the manifest note, focus its tab, then re-run the command.

### EPUB has no cover

Set `cover` in the manifest frontmatter and make sure the path resolves inside the vault. Test with **Validate current book** — broken cover paths are reported.

### TOC is too deep / too shallow

Adjust `toc_depth` per book or globally. The default (`2`) shows chapters and immediate sections.

### PDF has bad page breaks or split images

Make sure you're using **Typst** or a LaTeX engine — not weasyprint / wkhtmltopdf. Browser-style HTML PDF engines have weaker page-break and figure-placement logic. Typst and LaTeX handle widows, orphans, and figure floats out of the box.
