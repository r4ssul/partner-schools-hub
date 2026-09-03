import { describe, expect, it } from 'vitest'
import { shouldEnableLocalPreview } from './runtime'

describe('local preview production guard', () => {
  it('always disables preview when Supabase is configured', () => {
    expect(shouldEnableLocalPreview({ supabaseConfigured: true, explicitFlag: 'true', development: true })).toBe(false)
  })

  it('fails closed in production unless a test build explicitly opts in', () => {
    expect(shouldEnableLocalPreview({ supabaseConfigured: false, development: false })).toBe(false)
    expect(shouldEnableLocalPreview({ supabaseConfigured: false, explicitFlag: 'false', development: true })).toBe(false)
    expect(shouldEnableLocalPreview({ supabaseConfigured: false, explicitFlag: 'true', development: false })).toBe(true)
  })
})
