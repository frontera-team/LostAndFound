import { api } from '@/api/client';
import type { Role } from '@/types';

let adminRoleIdCache: number | null = null;

export async function getAdminRoleId(): Promise<number | null> {
  if (adminRoleIdCache != null) return adminRoleIdCache;
  const res = await api.request('/api/roles', { skipAuth: true });
  if (!res.ok) return null;
  const roles: Role[] = await res.json();
  const admin = roles.find((r) => r.role_name === 'admin');
  adminRoleIdCache = admin ? admin.id : null;
  return adminRoleIdCache;
}
