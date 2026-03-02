'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { UserButton, useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Palette, CreditCard, GitBranch, FileSpreadsheet, Users, Bookmark, LayoutTemplate, ShieldCheck } from 'lucide-react'
import { apiClient } from '@/lib/api'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/brand-kit', label: 'Branding', icon: Palette },
  { href: '/branches', label: 'Branches', icon: GitBranch },
  { href: '/import-mappings', label: 'Import Mappings', icon: FileSpreadsheet },
  { href: '/snippets', label: 'Snippets', icon: Bookmark },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/billing', label: 'Billing', icon: CreditCard },
]

const adminNavItems = [
  { href: '/admin/templates', label: 'Global Templates', icon: ShieldCheck },
]

export function Sidebar() {
  const pathname = usePathname()
  const { getToken } = useAuth()

  const { data: accountData } = useQuery({
    queryKey: ['account-me'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).accounts.me()
    },
    staleTime: 5 * 60 * 1000, // 5 min — role doesn't change often
  })

  const isProductAdmin = accountData?.data?.isProductAdmin ?? false

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-slate-900 text-white flex flex-col z-10">
      {/* Logo — 90% width, top/bottom 25% cropped via 3:1 aspect-ratio container */}
      <div className="px-2 py-1 border-b border-slate-700 flex items-center">
        <div className="relative w-[90%] overflow-hidden" style={{ aspectRatio: '3/1' }}>
          <Image
            src="/logo.png"
            alt="CounterPromo"
            fill
            sizes="200px"
            priority
            className="brightness-0 invert object-cover object-center"
          />
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {isProductAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Admin</p>
            </div>
            {adminNavItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'text-indigo-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User button */}
      <div className="px-4 py-4 border-t border-slate-700">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'h-8 w-8',
            },
          }}
        />
      </div>
    </aside>
  )
}
