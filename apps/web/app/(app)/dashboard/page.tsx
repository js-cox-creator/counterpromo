'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Plus, Folder, FolderOpen, MoreHorizontal, Pencil, Trash2, LayoutGrid, List } from 'lucide-react'
import { useBootstrap } from '@/hooks/use-bootstrap'
import { apiClient, type Promo, type PromoFolder } from '@/lib/api'
import { CreatePromoDialog } from '@/components/create-promo-dialog'
import { PromoCard } from '@/components/promo-card'
import { PromoListRow } from '@/components/promo-list-row'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ─── Folder sidebar item ──────────────────────────────────────────────────────

interface FolderItemProps {
  folder: PromoFolder
  active: boolean
  onClick: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

function FolderItem({ folder, active, onClick, onRename, onDelete }: FolderItemProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(folder.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commitRename() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== folder.name) {
      onRename(folder.id, trimmed)
    } else {
      setValue(folder.name)
    }
    setEditing(false)
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors ${
        active ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
      onClick={editing ? undefined : onClick}
    >
      {active ? (
        <FolderOpen className="h-4 w-4 shrink-0 text-slate-500" />
      ) : (
        <Folder className="h-4 w-4 shrink-0 text-slate-400" />
      )}

      {editing ? (
        <Input
          ref={inputRef}
          className="h-5 py-0 px-1 text-sm flex-1 min-w-0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') { setValue(folder.name); setEditing(false) }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 min-w-0 truncate">{folder.name}</span>
      )}

      <span className="text-xs text-slate-400 shrink-0">{folder.promoCount}</span>

      {!editing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200">
              <MoreHorizontal className="h-3 w-3 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
            >
              <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={(e) => { e.stopPropagation(); onDelete(folder.id) }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// ─── New folder inline input ──────────────────────────────────────────────────

interface NewFolderInputProps {
  onCreate: (name: string) => void
  onCancel: () => void
}

function NewFolderInput({ onCreate, onCancel }: NewFolderInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function commit() {
    if (committed.current) return
    committed.current = true
    const trimmed = value.trim()
    if (trimmed) onCreate(trimmed)
    else onCancel()
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <Folder className="h-4 w-4 shrink-0 text-slate-400" />
      <Input
        ref={inputRef}
        className="h-5 py-0 px-1 text-sm flex-1 min-w-0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Folder name"
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { committed.current = true; onCancel() }
        }}
      />
    </div>
  )
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeFolderId, setActiveFolderId] = useState<string | 'unfiled' | null>(null)
  const [addingFolder, setAddingFolder] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid'
    return (localStorage.getItem('counterpromo.dashboard.view') as 'grid' | 'list') ?? 'grid'
  })

  const { isNewAccount, isLoading: bootstrapLoading } = useBootstrap()

  useEffect(() => {
    if (!bootstrapLoading && isNewAccount) {
      router.push('/onboarding')
    }
  }, [isNewAccount, bootstrapLoading, router])

  function setViewPersisted(v: 'grid' | 'list') {
    setView(v)
    localStorage.setItem('counterpromo.dashboard.view', v)
  }

  const enabled = !bootstrapLoading && !isNewAccount

  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).folders.list()
    },
    enabled,
  })

  const { data: promosData, isLoading: promosLoading, error: promosError } = useQuery({
    queryKey: ['promos', activeFolderId],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).promos.list(activeFolderId ?? undefined)
    },
    enabled,
  })

  const { data: usageData } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).usage.get()
    },
    enabled,
  })

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const token = await getToken()
      return apiClient(token!).folders.create(name)
    },
    onSuccess: (res) => {
      setFolderError(null)
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      setActiveFolderId(res.data.id)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to create folder'
      setFolderError(msg)
    },
  })

  const renameFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const token = await getToken()
      return apiClient(token!).folders.rename(id, name)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] }),
  })

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      return apiClient(token!).folders.delete(id)
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      void queryClient.invalidateQueries({ queryKey: ['promos'] })
      if (activeFolderId === id) setActiveFolderId(null)
    },
  })

  const movePromo = useMutation({
    mutationFn: async ({ promoId, folderId }: { promoId: string; folderId: string | null }) => {
      const token = await getToken()
      return apiClient(token!).promos.patch(promoId, { folderId })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['promos'] })
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })

  const duplicatePromo = useMutation({
    mutationFn: async (promoId: string) => {
      const token = await getToken()
      return apiClient(token!).promos.duplicate(promoId)
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['promos'] })
      void queryClient.invalidateQueries({ queryKey: ['usage'] })
      router.push(`/promos/${res.data.id}`)
    },
  })

  const deletePromo = useMutation({
    mutationFn: async (promoId: string) => {
      const token = await getToken()
      return apiClient(token!).promos.delete(promoId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['promos'] })
    },
  })

  function handlePromoCreated(_promo: Promo) {
    void queryClient.invalidateQueries({ queryKey: ['promos'] })
    void queryClient.invalidateQueries({ queryKey: ['usage'] })
    void queryClient.invalidateQueries({ queryKey: ['folders'] })
  }

  const folders = foldersData?.data ?? []
  const promos = promosData?.data ?? []
  const usage = usageData?.data
  const totalPromoCount = promos.length

  if (bootstrapLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const usagePct = usage ? Math.min(100, Math.round((usage.promosUsed / usage.promosLimit) * 100)) : 0
  const atLimit = usage ? usage.promosUsed >= usage.promosLimit : false

  return (
    <div className="p-8 max-w-7xl">
      {/* Usage banner */}
      {usage && (
        <div className="mb-6 px-4 py-3 bg-slate-100 rounded-lg">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-slate-600">
              <span className="font-medium text-slate-800">{usage.promosUsed}</span>
              {' of '}
              <span className="font-medium text-slate-800">{usage.promosLimit}</span>
              {' promos used this month'}
            </span>
            {atLimit && (
              <span className="text-amber-700 font-medium text-xs">Limit reached</span>
            )}
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${atLimit ? 'bg-amber-500' : 'bg-indigo-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Your Promos</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Promo
        </Button>
      </div>

      {/* Toolbar row */}
      <TooltipProvider>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            {activeFolderId === null
              ? 'All promos'
              : activeFolderId === 'unfiled'
              ? 'Unfiled'
              : folders.find((f) => f.id === activeFolderId)?.name ?? 'Folder'}
          </p>
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-slate-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
                  onClick={() => setViewPersisted('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Grid view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
                  onClick={() => setViewPersisted('list')}
                >
                  <List className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>List view</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-0">
        {/* Folder sidebar */}
        <aside className="w-52 shrink-0 border-r border-slate-200 pr-4 mr-4 space-y-0.5">
          {/* All promos */}
          <div
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors ${
              activeFolderId === null
                ? 'bg-slate-200 text-slate-900 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            onClick={() => setActiveFolderId(null)}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="flex-1 min-w-0 truncate">All promos</span>
            <span className="text-xs text-slate-400 shrink-0">{totalPromoCount}</span>
          </div>

          {/* Folders section label */}
          {folders.length > 0 && (
            <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Folders
            </p>
          )}

          {/* Folder list */}
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              active={activeFolderId === folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              onRename={(id, name) => renameFolder.mutate({ id, name })}
              onDelete={(id) => deleteFolder.mutate(id)}
            />
          ))}

          {/* Inline new folder input */}
          {addingFolder && (
            <NewFolderInput
              onCreate={(name) => {
                createFolder.mutate(name)
                setAddingFolder(false)
              }}
              onCancel={() => setAddingFolder(false)}
            />
          )}

          {/* Folder error */}
          {folderError && (
            <p className="text-xs text-red-600 px-2 py-1">{folderError}</p>
          )}

          {/* New folder button — sticky at bottom of section */}
          {!addingFolder && (
            <button
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 rounded-md border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors mt-2"
              onClick={() => { setFolderError(null); setAddingFolder(true) }}
            >
              <Plus className="h-3.5 w-3.5" />
              New folder
            </button>
          )}
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {promosLoading ? (
            view === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            )
          ) : promosError ? (
            <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
              Failed to load promos. Please refresh the page.
            </div>
          ) : promos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-slate-500 text-base mb-4">No promos yet</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Create your first promo
              </Button>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {promos.map((promo) => (
                <PromoCard
                  key={promo.id}
                  promo={promo}
                  folders={folders}
                  onDuplicate={(id) => duplicatePromo.mutate(id)}
                  onMove={(promoId, folderId) => movePromo.mutate({ promoId, folderId })}
                  onDelete={(id) => deletePromo.mutate(id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* List header */}
              <div className="flex items-center gap-4 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <div className="w-[40px] shrink-0" />
                <div className="flex-1 min-w-0">Title</div>
                <div className="w-24 shrink-0">Status</div>
                <div className="w-20 text-right shrink-0">Items</div>
                <div className="w-32 shrink-0">Created</div>
                <div className="w-9 shrink-0" />
              </div>
              {promos.map((promo) => (
                <PromoListRow
                  key={promo.id}
                  promo={promo}
                  folders={folders}
                  onDuplicate={(id) => duplicatePromo.mutate(id)}
                  onMove={(promoId, folderId) => movePromo.mutate({ promoId, folderId })}
                  onDelete={(id) => deletePromo.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreatePromoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handlePromoCreated}
        activeFolderId={activeFolderId && activeFolderId !== 'unfiled' ? activeFolderId : undefined}
        folders={folders}
      />
    </div>
  )
}
