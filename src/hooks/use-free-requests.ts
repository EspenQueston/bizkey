/**
 * Manages the anonymous free-request counter stored in localStorage.
 * Key: "bizkey_free_requests"
 * Value: JSON { used: number, pendingData?: { type: 'url'|'image'|'keyword', value: string, imageBase64?: string } }
 */

const STORAGE_KEY = 'bizkey_free_requests'
const MAX_FREE = 3

export interface FreeRequestState {
  used: number
  pendingData?: {
    type: 'url' | 'image' | 'keyword'
    value: string
    fileName?: string
  }
}

export function getFreeRequestState(): FreeRequestState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { used: 0 }
    return JSON.parse(raw) as FreeRequestState
  } catch {
    return { used: 0 }
  }
}

export function incrementFreeRequests(): number {
  const state = getFreeRequestState()
  const next = { ...state, used: Math.min(state.used + 1, MAX_FREE) }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next.used
}

export function savePendingRequest(data: FreeRequestState['pendingData']): void {
  const state = getFreeRequestState()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, pendingData: data }))
}

export function clearPendingRequest(): void {
  const state = getFreeRequestState()
  const { pendingData: _ignored, ...rest } = state
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
}

export function getRemainingFree(): number {
  return Math.max(0, MAX_FREE - getFreeRequestState().used)
}

export const FREE_REQUEST_MAX = MAX_FREE
