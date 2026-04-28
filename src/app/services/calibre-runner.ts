import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { runProcess } from './pandoc-runner'

export interface CalibreResult {
    outputPath: string
    durationMs: number
    stderr: string
}

/**
 * Wraps Calibre's `ebook-convert`. Used to produce MOBI from an existing EPUB.
 */
export class CalibreRunner {
    constructor(private readonly settings: PluginSettings) {}

    async epubToMobi(epubPath: string, mobiPath: string): Promise<CalibreResult> {
        await fs.mkdir(path.dirname(mobiPath), { recursive: true })
        const started = Date.now()
        const stderr = await runProcess(
            this.settings.ebookConvertPath,
            [epubPath, mobiPath],
            path.dirname(epubPath)
        )
        return { outputPath: mobiPath, durationMs: Date.now() - started, stderr }
    }
}
