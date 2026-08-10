import { Role } from '@prisma/client';
export type Permission='profile:own'|'cart:own'|'order:own'|'inventory:read'|'inventory:write'|'order:support'|'product:write'|'promotion:write'|'user:write'|'report:read'|'role:write'|'settings:write'|'audit:read';
export const PERMISSIONS:Record<Role,readonly Permission[]>={
  CUSTOMER:['profile:own','cart:own','order:own'],
  WAREHOUSE:['inventory:read','inventory:write'],
  SUPPORT:['order:support'],
  ADMIN:['order:support','product:write','promotion:write','user:write','report:read','inventory:read'],
  SUPERADMIN:['profile:own','cart:own','order:own','inventory:read','inventory:write','order:support','product:write','promotion:write','user:write','report:read','role:write','settings:write','audit:read']
};
