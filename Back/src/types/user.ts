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
  isActive?: boolean;
  password?: string;
}

// Fields a user can change about itself. Email, role, account status and
// password have dedicated flows and are deliberately excluded.
export interface UpdateOwnProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  photoUrl?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UserUpdateResult {
  user: UserResponse;
  token: string | null;
  previousEmail: string | null;
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
  isActive: boolean;
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
  isActive?: boolean;
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
