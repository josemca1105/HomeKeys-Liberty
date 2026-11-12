import type { Role } from "@prisma/client";

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone: string;
  photoUrl?: string | null;
  role?: Role;
}

export interface RegisterUserResult {
  user: UserResponse;
  invitationSent: boolean;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  photoUrl?: string | null;
  role?: Role;
  password?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UserUpdateResult {
  user: UserResponse;
  token: string | null;
}

export interface PasswordChangeResult {
  user: UserResponse;
  token: string;
}

export interface UserResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photoUrl: string | null;
  role: Role;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserSortField =
  | "createdAt"
  | "firstName"
  | "lastName"
  | "email"
  | "role";

export type SortOrder = "asc" | "desc";

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  role?: Role;
  sortBy: UserSortField;
  sortOrder: SortOrder;
}

export interface UserPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedUsersResult {
  users: UserResponse[];
  pagination: UserPagination;
}
