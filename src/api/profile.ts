import { http } from './client'
import type { ChangePasswordRequest, Profile, UpdateAvatarRequest, UpdateProfileRequest } from '@/contracts'

export async function getProfile(signal?: AbortSignal): Promise<Profile> {
  const { data } = await http.get<Profile>('/profile', { signal })
  return data
}

export async function updateProfile(body: UpdateProfileRequest): Promise<Profile> {
  const { data } = await http.patch<Profile>('/profile', body)
  return data
}

export async function updateAvatar(body: UpdateAvatarRequest): Promise<Profile> {
  const { data } = await http.put<Profile>('/profile/avatar', body)
  return data
}

export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  await http.post('/profile/password', body)
}
