'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { UserButton, useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Palette,
  CreditCard,
  GitBranch,
  FileSpreadsheet,
  Users,
  Bookmark,
  LayoutTemplate,
  ShieldCheck,
  Settings,
  Package,
  Shield,
  ChevronDown,
} from 'lucide-react'
import { apiClient } from '@/lib/api'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

interface NavGroup {
  type: 'group'
  label: string
  icon: React.ElementType
  items: NavItem[]
}

interface NavLink {
  type: 'link'
  href: string
  label: string
  icon: React.ElementType
}

type NavEntry = NavLink | NavGroup

const navEntries: NavEntry[] = [
  { type: 'link', href: '/dashboard', label: 'Promos', icon: LayoutDashboard },
  {
    type: 'group',
    label: 'Settings',
    icon: Settings,
    items: [
      { href: '/templates', label: 'Templates', icon: LayoutTemplate },
      { href: '/brand-kit', label: 'Branding', icon: Palette },
      { href: '/branches', label: 'Branches', icon: GitBranch },
    ],
  },
  {
    type: 'group',
    label: 'Products',
    icon: Package,
    items: [
      { href: '/import-mappings', label: 'Import Mappings', icon: FileSpreadsheet },
      { href: '/snippets', label: 'Snippets', icon: Bookmark },
    ],
  },
  {
    type: 'group',
    label: 'Admin',
    icon: Shield,
    items: [
      { href: '/team', label: 'Team', icon: Users },
      { href: '/billing', label: 'Billing', icon: CreditCard },
    ],
  },
]

const adminNavItems: NavItem[] = [
  { href: '/admin/templates', label: 'Global Templates', icon: ShieldCheck },
]

function isGroupActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
}

function NavGroupItem({ group }: { group: NavGroup }) {
  const pathname = usePathname()
  const active = isGroupActive(group, pathname)
  const [open, setOpen] = useState(active)
  const Icon = group.icon

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform text-slate-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-slate-700 space-y-0.5">
          {group.items.map(({ href, label, icon: ItemIcon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ItemIcon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { getToken } = useAuth()

  const { data: accountData } = useQuery({
    queryKey: ['account-me'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).accounts.me()
    },
    staleTime: 5 * 60 * 1000,
  })

  const isProductAdmin = accountData?.data?.isProductAdmin ?? false

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-slate-900 text-white flex flex-col z-10">
      {/* Logo */}
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

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navEntries.map((entry) => {
          if (entry.type === 'link') {
            const isActive = pathname === entry.href || pathname.startsWith(entry.href + '/')
            const Icon = entry.icon
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {entry.label}
              </Link>
            )
          }
          return <NavGroupItem key={entry.label} group={entry} />
        })}

        {isProductAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Product Admin</p>
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
