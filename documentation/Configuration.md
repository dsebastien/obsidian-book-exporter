# Configuration

Reference of every plugin setting and per-book frontmatter override. See `documentation/plans/01-mvp.md` for descriptions; the `Settings` tab in Obsidian is the source of truth at runtime.

## Plugin settings

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| `pandocPath` | string | `pandoc` | Full path or PATH name. |
| `ebookConvertPath` | string | `ebook-convert` | Required for MOBI. |
| `defaultOutputDir` | string | `Exports/Books` | Vault-relative. |
| `defaultPdfEngine` | enum | `xelatex` | xelatex / weasyprint / wkhtmltopdf / tectonic / typst |
| `defaultLanguage` | string | `en` | BCP-47 |
| `frontMatterHeading` | string | `Front Matter` | |
| `chaptersHeading` | string | `Chapters` | |
| `backMatterHeading` | string | `Back Matter` | |
| `includeTocByDefault` | boolean | true | |
| `tocDepthDefault` | integer | 2 | |
| `pageBreakPerChapterDefault` | boolean | true | |
| `defaultFormats` | list | `[epub, pdf, mobi]` | Used by the "all formats" command. |
| `keepTempFiles` | boolean | false | Debug. |
| `debug` | boolean | false | Verbose console logging. |

## Per-book frontmatter (`book_export`)

```yaml
book_export:
  output_dir: "60 Archives/Books/Exports"
  pdf_engine: xelatex
  toc_depth: 2
  include_toc: true
  page_break_per_chapter: true
  formats: [epub, pdf]
  pandoc_extra_args: ["--top-level-division=chapter"]
```

All fields are optional. Anything missing falls back to the corresponding plugin setting.
