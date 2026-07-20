import { describe, expect, it } from 'vitest'
import { formatBytes, formatDate } from './format'

describe('formatDate', () => {
  it('returns a dash for null or undefined', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  it('formats an ISO date to a readable day', () => {
    const formatted = formatDate('2026-07-20T09:00:00Z')
    expect(formatted).toContain('2026')
    expect(formatted).not.toBe('—')
  })
})

describe('formatBytes', () => {
  it('returns a dash for null or undefined', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })

  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes without decimals', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('caps at the largest unit', () => {
    expect(formatBytes(1024 ** 6)).toContain('TB')
  })
})
