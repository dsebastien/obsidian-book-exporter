# Configuration

Reference of every plugin setting and per-book frontmatter override. See `documentation/plans/01-mvp.md` for descriptions; the `Settings` tab in Obsidian is the source of truth at runtime.

## Plugin settings

| Setting                      | Type    | Default                                                 | Notes                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pandocPath`                 | string  | `pandoc`                                                | Required. Full path or PATH name.                                                                                                                                                                                                                                      |
| `pdfEnginePath`              | string  | (empty)                                                 | Optional full path to the PDF engine binary. Forwarded as `--pdf-engine=<path>`, bypassing PATH lookup. Used only when its basename matches `defaultPdfEngine`. Needed on macOS where Obsidian (Electron) starts with a stripped PATH that excludes Homebrew / MacTeX. |
| `extraPath`                  | string  | (empty)                                                 | Optional directories prepended to `PATH` for spawned pandoc / probe processes. OS path separator (`:` on macOS/Linux, `;` on Windows). Lets pandoc resolve PDF engines without specifying full paths for each.                                                         |
| `defaultOutputDir`           | string  | (empty — required)                                      | Absolute filesystem path. `~` is expanded. Plugin refuses to export until set.                                                                                                                                                                                         |
| `defaultPdfEngine`           | enum    | `typst`                                                 | `typst` (recommended) / `xelatex` / `tectonic`                                                                                                                                                                                                                         |
| `defaultLanguage`            | string  | `en`                                                    | BCP-47                                                                                                                                                                                                                                                                 |
| `defaultAuthors`             | list    | `[]`                                                    | Used when the manifest doesn't define `authors:`. Empty falls back to `Anonymous`.                                                                                                                                                                                     |
| `sectionsToSkip`             | list    | `[Related, References, Title Options, Target Audience]` | Heading names (case-insensitive). Applied to the manifest body before parsing AND to each linked note when inlining. Replaces — does not extend — when overridden per book.                                                                                            |
| `includeTocByDefault`        | boolean | true                                                    |                                                                                                                                                                                                                                                                        |
| `tocDepthDefault`            | integer | 2                                                       |                                                                                                                                                                                                                                                                        |
| `pageBreakPerChapterDefault` | boolean | true                                                    | Inserts a page break before each top-level section (the lowest-numbered heading level used in the manifest).                                                                                                                                                           |
| `defaultFormats`             | list    | `[epub, pdf]`                                           | Used by the "all formats" command.                                                                                                                                                                                                                                     |
| `keepTempFiles`              | boolean | false                                                   | Debug.                                                                                                                                                                                                                                                                 |
| `debug`                      | boolean | false                                                   | Verbose console logging.                                                                                                                                                                                                                                               |

## Per-book frontmatter (`book_export`)

```yaml
book_export:
    output_dir: '~/Books/The Context Layer'
    pdf_engine: typst
    toc_depth: 2
    include_toc: true
    page_break_per_chapter: true
    formats: [epub, pdf]
    sections_to_skip: [Related, References, Notes]
    pandoc_extra_args: ['--top-level-division=chapter']
```

All fields are optional. Anything missing falls back to the corresponding plugin setting.
