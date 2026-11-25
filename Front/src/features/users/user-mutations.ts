import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createUser,
  deleteUser,
  resendUserInvitation,
  sendUserPasswordReset,
  updateUser,
} from './user.api'
import { userQueryKeys } from './user-queries'
import type { CreateUserRequest, UpdateUserRequest } from './user.types'

interface UpdateUserVariables {
  userId: number
  input: UpdateUserRequest
}

// Invalidating the whole `users` tree also refreshes the agent directory used
// by the captures list, so renamed agents stop showing stale names.
export function useCreateUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateUserRequest) => createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, input }: UpdateUserVariables) =>
      updateUser(userId, input),
    onSuccess: (user) => {
      queryClient.setQueryData(userQueryKeys.detail(user.id), user)
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}

export function useResendUserInvitationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => resendUserInvitation(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}

export function useSendUserPasswordResetMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => sendUserPasswordReset(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: (_deletedId, userId) => {
      queryClient.removeQueries({ queryKey: userQueryKeys.detail(userId) })
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}
