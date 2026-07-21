export interface NavItem {
  href: string;
  label: string;
}

const baseNavItems: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/reports", label: "Reports" },
  { href: "/settlement", label: "Settlement" },
  { href: "/activity", label: "Activity" },
  { href: "/recurring", label: "Recurring" },
];

/**
 * The ordered nav items shared by the desktop links and the mobile drawer.
 * Admins get an extra "Admin" entry appended. Returns a fresh array each call
 * so callers can never mutate the shared base list.
 */
export function buildNavItems(isAdmin: boolean): NavItem[] {
  const items = [...baseNavItems];
  if (isAdmin) {
    items.push({ href: "/admin", label: "Admin" });
  }
  return items;
}
