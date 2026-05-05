"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth";

const NAV = [
  { href: "/admin/tenants", label: "Tenants" },
];

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-muted">
      <aside className="w-56 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <p className="font-bold text-lg">CardForge</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Platform Admin</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                pathname.startsWith(href) ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button
            onClick={logout}
            className="w-full text-left text-sm text-destructive hover:underline px-3 py-1"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
