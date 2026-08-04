// Menus an Operator's access can be restricted to (per user). Verbatim.
export const OPERATOR_MENUS: { key: string; label: string; path: string }[] = [
  { key: 'dashboard', label: 'Dashboard', path: 'Dashboard' },
  { key: 'bills', label: 'Bills', path: 'Bills' },
  { key: 'quotations', label: 'Quotations', path: 'Quotations' },
  { key: 'customers', label: 'Customers', path: 'Customers' },
  { key: 'reports', label: 'Reports', path: 'Reports' },
  { key: 'companies', label: 'Companies', path: 'Companies' },
]

export const ALL_OPERATOR_MENU_KEYS = OPERATOR_MENUS.map((m) => m.key)

export function canAccess(role: 'Admin' | 'Operator', allowedMenus: string[] | undefined, key: string): boolean {
  if (role === 'Admin') return true
  if (!allowedMenus) return true
  return allowedMenus.includes(key)
}
