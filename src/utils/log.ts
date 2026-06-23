import * as pluginManifest from '../../manifest.json'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const LOG_SEPARATOR = '--------------------------------------------------------'
export const LOG_PREFIX = `${pluginManifest.name}:`

/**
 * Whether `debug`-level messages are emitted. Controlled by the plugin's
 * "Verbose console logging" setting via {@link setDebugLogging}; off by
 * default so a normal install stays quiet.
 */
let debugLoggingEnabled = false

/**
 * Enables/disables `debug`-level logging. Called by the plugin on load and
 * whenever settings are saved.
 */
export const setDebugLogging = (enabled: boolean): void => {
    debugLoggingEnabled = enabled
}

/**
 * Log a message. `debug`-level (and level-less) messages are emitted only when
 * verbose logging is enabled; `info`/`warn`/`error` always are. Obsidian
 * disallows `console.log`/`console.info`, so `info` is routed to
 * `console.debug`.
 *
 * @param message
 * @param level
 * @param data
 */
export const log = (message: string, level?: LogLevel, ...data: unknown[]): void => {
    const logMessage = `${LOG_PREFIX} ${message}`
    const args: unknown[] = data.length > 0 ? [logMessage, ...data] : [logMessage]
    switch (level) {
        case 'info':
            console.debug(...args)
            break
        case 'warn':
            console.warn(...args)
            break
        case 'error':
            console.error(...args)
            break
        case 'debug':
        default:
            if (debugLoggingEnabled) console.debug(...args)
    }
}
