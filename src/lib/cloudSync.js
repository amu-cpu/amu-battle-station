import { isSupabaseConfigured, supabase } from './supabaseClient'
import { normalizeAppState } from '../utils/storage'

async function getSessionUserId() {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  return data.session?.user?.id || null
}

export const cloudSyncAvailable = isSupabaseConfigured

export async function getCurrentSession() {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  return data.session
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {}

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return () => data.subscription.unsubscribe()
}

export async function signInWithEmail(email) {
  if (!supabase) throw new Error('Supabase is not configured')

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) throw error
}

export async function signOut() {
  if (!supabase) return

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function loadCloudState() {
  if (!supabase) return null

  const userId = await getSessionUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from('app_states')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  return data?.payload ? { ...data.payload, cloudUpdatedAt: data.updated_at } : null
}

export async function saveCloudState(payload) {
  if (!supabase) return null

  const userId = await getSessionUserId()
  if (!userId) return null

  const nextPayload = normalizeAppState({
    ...payload,
    updatedAt: new Date().toISOString(),
  })

  const { data, error } = await supabase
    .from('app_states')
    .upsert(
      {
        user_id: userId,
        payload: nextPayload,
        updated_at: nextPayload.updatedAt,
      },
      { onConflict: 'user_id' },
    )
    .select('payload, updated_at')
    .single()

  if (error) throw error

  return data?.payload || nextPayload
}

export function mergeLocalAndCloudState(localState, cloudState, choice) {
  if (choice === 'cloud') return cloudState
  if (choice === 'local') return localState
  return null
}
