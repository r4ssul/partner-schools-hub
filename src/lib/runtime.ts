import { isSupabaseConfigured } from './supabase'

export function shouldEnableLocalPreview(input: { supabaseConfigured: boolean; explicitFlag?: string; development: boolean }) {
  if (input.supabaseConfigured) return false
  if (input.explicitFlag === 'true') return true
  if (input.explicitFlag === 'false') return false
  return input.development
}

export const isLocalPreviewEnabled = shouldEnableLocalPreview({
  supabaseConfigured: isSupabaseConfigured,
  explicitFlag: import.meta.env.VITE_ENABLE_LOCAL_PREVIEW,
  development: import.meta.env.DEV,
})
