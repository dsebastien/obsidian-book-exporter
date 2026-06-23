import { describe, expect, it } from 'bun:test'
import { PreviewTempDirs } from './temp-dirs'

describe('PreviewTempDirs', () => {
    it('removes every registered dir on cleanup and forgets them', async () => {
        const removed: string[] = []
        const tracker = new PreviewTempDirs((d) => {
            removed.push(d)
            return Promise.resolve()
        })

        tracker.register('/tmp/a')
        tracker.register('/tmp/b')
        expect(tracker.size).toBe(2)

        await tracker.cleanupAll()

        expect(removed.sort()).toEqual(['/tmp/a', '/tmp/b'])
        expect(tracker.size).toBe(0)
    })

    it('dedupes the same dir registered twice', () => {
        const tracker = new PreviewTempDirs(() => Promise.resolve())
        tracker.register('/tmp/a')
        tracker.register('/tmp/a')
        expect(tracker.size).toBe(1)
    })

    it('swallows remover failures so unload is never blocked', async () => {
        const tracker = new PreviewTempDirs(() => Promise.reject(new Error('EBUSY')))
        tracker.register('/tmp/a')
        const result = await tracker.cleanupAll()
        expect(result).toBeUndefined()
        expect(tracker.size).toBe(0)
    })

    it('a second cleanup is a no-op (nothing left to remove)', async () => {
        let calls = 0
        const tracker = new PreviewTempDirs(() => {
            calls++
            return Promise.resolve()
        })
        tracker.register('/tmp/a')
        await tracker.cleanupAll()
        await tracker.cleanupAll()
        expect(calls).toBe(1)
    })
})
