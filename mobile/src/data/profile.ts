import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File, Paths } from 'expo-file-system'
import { create } from 'zustand'

export interface LocalProfile { displayName: string; username: string; photo: string | null }
export interface PickedPhoto { uri: string; extension: 'jpg' | 'png' | 'heic' | 'webp' }
const KEY = 'seam-profile-v1'
const EMPTY: LocalProfile = { displayName: '', username: '', photo: null }
const PHOTO_NAME = /^avatar-[0-9]+\.(jpg|png|heic|webp)$/
const folder = () => new Directory(Paths.document, 'seam-profile')
export const useProfile = create<{ profile: LocalProfile; saving: boolean }>(() => ({ profile: EMPTY, saving: false }))
export const normalizeUsername = (name: string) => name.trim().replace(/^@/, '').toLowerCase()
export function profileProblem(displayName: string, username: string): string | null {
  if (!displayName.trim()) return 'Enter your display name.'
  if (displayName.trim().length > 32) return 'Keep your display name under 33 characters.'
  if (!/^[a-z0-9_]{3,24}$/.test(normalizeUsername(username))) return 'Use 3–24 letters, numbers or underscores for your username.'
  return null
}
/** Store a filename, not an iOS container URL: the app's container can move after an update. */
export const profilePhotoUri = (photo: string | null) => photo && PHOTO_NAME.test(photo) ? new File(folder(), photo).uri : null

export async function loadProfile() {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return
    const p = JSON.parse(raw) as Partial<LocalProfile>
    useProfile.setState({ profile: {
      displayName: typeof p.displayName === 'string' ? p.displayName.slice(0, 32) : '',
      username: typeof p.username === 'string' && /^[a-z0-9_]{3,24}$/.test(p.username) ? p.username : '',
      photo: typeof p.photo === 'string' && PHOTO_NAME.test(p.photo) ? p.photo : null,
    } })
  } catch { /* A missing or unreadable profile must never prevent a league from opening. */ }
}

/** Undefined keeps the current photo; null removes it. Editing stays local until Save succeeds. */
export async function saveProfile(displayName: string, username: string, photo?: PickedPhoto | null): Promise<string | null> {
  const problem = profileProblem(displayName, username)
  if (problem) return problem
  if (useProfile.getState().saving) return 'Your profile is already saving.'
  const old = useProfile.getState().profile
  useProfile.setState({ saving: true })
  let copied: File | null = null
  try {
    let filename = old.photo
    if (photo) {
      const dir = folder()
      await dir.create({ idempotent: true, intermediates: true })
      filename = `avatar-${Date.now()}.${photo.extension}`
      copied = new File(dir, filename)
      await new File(photo.uri).copy(copied)
    } else if (photo === null) filename = null
    const profile: LocalProfile = { displayName: displayName.trim(), username: normalizeUsername(username), photo: filename }
    await AsyncStorage.setItem(KEY, JSON.stringify(profile))
    useProfile.setState({ profile })
    if (old.photo && old.photo !== filename) {
      try { const file = new File(folder(), old.photo); if (file.exists) await file.delete() } catch { /* Saving succeeded; an old photo can be cleaned up later. */ }
    }
    return null
  } catch {
    try { if (copied?.exists) await copied.delete() } catch { /* Keep the existing saved profile. */ }
    return 'Could not save your profile. Please try again.'
  } finally {
    useProfile.setState({ saving: false })
  }
}
