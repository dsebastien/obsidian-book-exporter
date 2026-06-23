import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { log, setDebugLogging, LOG_PREFIX } from './log'

afterEach(() => {
    setDebugLogging(false)
})

describe('log debug gating (issue #25)', () => {
    it('suppresses debug messages when verbose logging is disabled', () => {
        setDebugLogging(false)
        const debug = spyOn(console, 'debug').mockImplementation(() => {})
        try {
            log('quiet', 'debug')
            log('also quiet') // level-less defaults to debug
            expect(debug).not.toHaveBeenCalled()
        } finally {
            debug.mockRestore()
        }
    })

    it('emits debug messages when verbose logging is enabled', () => {
        setDebugLogging(true)
        const debug = spyOn(console, 'debug').mockImplementation(() => {})
        try {
            log('loud', 'debug')
            expect(debug).toHaveBeenCalledTimes(1)
            expect(debug.mock.calls[0]?.[0]).toBe(`${LOG_PREFIX} loud`)
        } finally {
            debug.mockRestore()
        }
    })

    it('always emits warn and error regardless of the flag', () => {
        setDebugLogging(false)
        const warn = spyOn(console, 'warn').mockImplementation(() => {})
        const error = spyOn(console, 'error').mockImplementation(() => {})
        try {
            log('w', 'warn')
            log('e', 'error')
            expect(warn).toHaveBeenCalledTimes(1)
            expect(error).toHaveBeenCalledTimes(1)
        } finally {
            warn.mockRestore()
            error.mockRestore()
        }
    })

    it('does not append an empty data array when no data is passed', () => {
        const error = spyOn(console, 'error').mockImplementation(() => {})
        try {
            log('msg', 'error')
            expect(error.mock.calls[0]).toEqual([`${LOG_PREFIX} msg`])
        } finally {
            error.mockRestore()
        }
    })

    it('forwards extra data arguments when provided', () => {
        const error = spyOn(console, 'error').mockImplementation(() => {})
        try {
            const payload = { code: 43 }
            log('msg', 'error', payload)
            expect(error.mock.calls[0]).toEqual([`${LOG_PREFIX} msg`, payload])
        } finally {
            error.mockRestore()
        }
    })
})
