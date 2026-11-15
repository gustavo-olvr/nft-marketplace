import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changePassword, getProfile, updateAvatar, updateProfile } from '@/api/profile'
import type { Profile, SessionResponse } from '@/contracts'
import { sessionKeys } from '@/features/auth/session'

export const profileKeys = { me: ['profile'] as const }

export const useProfile = () =>
  useQuery({ queryKey: profileKeys.me, queryFn: ({ signal }) => getProfile(signal) })

function useApplyProfile() {
  const qc = useQueryClient()
  return (profile: Profile) => {
    qc.setQueryData(profileKeys.me, profile)
    qc.setQueryData<SessionResponse | null>(sessionKeys.me, (prev) =>
      prev
        ? {
            ...prev,
            user: { id: profile.id, name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl },
          }
        : prev,
    )
  }
}

export function useUpdateProfile() {
  const apply = useApplyProfile()
  return useMutation({ mutationFn: updateProfile, onSuccess: apply })
}

export function useUpdateAvatar() {
  const apply = useApplyProfile()
  return useMutation({ mutationFn: updateAvatar, onSuccess: apply })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}
