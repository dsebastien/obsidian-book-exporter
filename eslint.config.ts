import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import obsidianmd from 'eslint-plugin-obsidianmd'

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    // @ts-expect-error - obsidianmd types are incomplete but the config works at runtime
    ...obsidianmd.configs['recommended'],
    eslintConfigPrettier,
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            'scripts/**',
            '.cz-config.cjs',
            'prettier.config.cjs',
            'package.json'
        ]
    },
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                // Tests and build tooling run under the Bun runtime
                Bun: 'readonly',
                // Obsidian global functions
                createDiv: 'readonly',
                createEl: 'readonly',
                createSpan: 'readonly',
                createFragment: 'readonly'
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-deprecated': 'off',
            // These are too strict for dynamic plugin APIs
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            // Obsidian methods are dynamically added to prototypes
            '@typescript-eslint/no-unsafe-enum-comparison': 'off',
            'no-prototype-builtins': 'off',
            // Allow confirm for delete confirmations
            'no-alert': 'off',
            // Never disable obsidianmd/* rules here: the community catalog
            // reviewer runs its own ruleset against the git archive, so a
            // local disable only hides the finding until submission.
            // Brand names are the supported escape hatch for sentence-case.
            'obsidianmd/ui/sentence-case': [
                'error',
                {
                    brands: [
                        'Knowii',
                        'X',
                        'GitHub Sponsors',
                        'Sébastien Dubois',
                        'dSebastien',
                        // Repo-specific tool/font/plugin names in UI copy.
                        // NOTE: brands and acronyms are enforced BOTH ways —
                        // listing one forces every prose occurrence to that
                        // exact casing (e.g. 'pandoc runs' -> 'Pandoc runs').
                        'Pandoc',
                        'Book Exporter',
                        'Liberation Serif',
                        'Liberation Mono',
                        'Obsidian'
                    ],
                    acronyms: ['PDF', 'EPUB', 'TOC', 'URL', 'API'],
                    // Words with intentional casing in both forms. Never put
                    // PATH or OS in acronyms: that would rewrite every ordinary
                    // "path"/"os" to uppercase.
                    ignoreWords: ['PATH', 'OS', 'Settings'],
                    ignoreRegex: [
                        // Single-token literals (placeholders, paths, ids)
                        '^\\S+$',
                        // Quoted references to literal setting/heading names
                        '"[^"]+"',
                        // Hyphenated acronym the tokenizer cannot match
                        'BCP-47',
                        // Placeholder listing actual (Title Case) headings
                        '^Related, References, Title Options, Target Audience$'
                    ]
                }
            ]
        }
    }
)
