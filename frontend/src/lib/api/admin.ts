import { ensureOK, langHeaders } from "./client"

export interface AdminUserInfo {
  id: string
  username: string
  name: string
  role: string
  created_at: string
}

export interface CreateAdminUserInput {
  username: string
  password: string
  name?: string
  role: string
}

export interface AdminUserPatch {
  role?: string
  password?: string
}

export interface RegistrationSetting {
  allow_registration: boolean
}

/** Lists all users. */
export async function fetchAdminUsers(): Promise<AdminUserInfo[]> {
  const res = await fetch("/v1/admin/users", { headers: langHeaders() })
  await ensureOK(res, "api.fetchAdminUsersFailed")
  const data = (await res.json()) as { users?: AdminUserInfo[] }
  return data.users ?? []
}

/** Creates a user with an explicit role. */
export async function createAdminUser(
  input: CreateAdminUserInput
): Promise<void> {
  const res = await fetch("/v1/admin/users", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      username: input.username.trim(),
      password: input.password,
      name: input.name?.trim() || undefined,
      role: input.role,
    }),
  })
  await ensureOK(res, "api.createAdminUserFailed")
}

/** Updates a user's role and/or password. */
export async function updateAdminUser(
  id: string,
  patch: AdminUserPatch
): Promise<void> {
  const res = await fetch(`/v1/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(patch),
  })
  await ensureOK(res, "api.updateAdminUserFailed")
}

/** Deletes a user by id. */
export async function deleteAdminUser(id: string): Promise<void> {
  const res = await fetch(`/v1/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  await ensureOK(res, "api.deleteAdminUserFailed")
}

/** Returns whether open self-registration is allowed. */
export async function fetchRegistrationSetting(): Promise<RegistrationSetting> {
  const res = await fetch("/v1/admin/settings/registration", {
    headers: langHeaders(),
  })
  await ensureOK(res, "api.fetchRegistrationFailed")
  return res.json()
}

/** Toggles open self-registration. */
export async function updateRegistrationSetting(allow: boolean): Promise<void> {
  const res = await fetch("/v1/admin/settings/registration", {
    method: "PUT",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ allow_registration: allow }),
  })
  await ensureOK(res, "api.updateRegistrationFailed")
}
