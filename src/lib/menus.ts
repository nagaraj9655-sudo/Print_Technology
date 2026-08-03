// Menus an Operator's access can be restricted to (per user).
// Admins always see everything; Users & Settings are Admin-only and not listed here.
export const OPERATOR_MENUS: { key: string; label: string; path: string }[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'bills', label: 'Bills', path: '/bills' },
  { key: 'quotations', label: 'Quotations', path: '/quotations' },
  { key: 'customers', label: 'Customers', path: '/customers' },
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'companies', label: 'Companies', path: '/companies' },
]

export const ALL_OPERATOR_MENU_KEYS = OPERATOR_MENUS.map((m) => m.key)

// A user may access a nav key if they're Admin, or the key is in their allowedMenus
// (undefined allowedMenus = full operator access).
export function canAccess(role: 'Admin' | 'Operator', allowedMenus: string[] | undefined, key: string): boolean {
  if (role === 'Admin') return true
  if (!allowedMenus) return true
  return allowedMenus.includes(key)
}
