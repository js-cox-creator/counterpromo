'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Folder, FolderOpen, FolderInput, MoreHorizontal, Pencil, Trash2, Copy } from 'lucide-react'
import { useBootstrap } from '@/hooks/use-bootstrap'
import { apiClient, type Promo, type PromoFolder } from '@/lib/api'
import { CreatePromoDialog } from '@/components/create-promo-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusVariant(status: string): string {
  if (status === 'ready') return 'bg-green-100 text-green-800 border-green-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

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
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200">
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

// ─── Move-to-folder popover ───────────────────────────────────────────────────

interface MoveToFolderProps {
  promo: Promo
  folders: PromoFolder[]
  onMove: (promoId: string, folderId: string | null) => void
}

function MoveToFolder({ promo, folders, onMove }: MoveToFolderProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="Move to folder"
          onClick={(e) => e.stopPropagation()}
        >
          <FolderInput className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end" onClick={(e) => e.stopPropagation()}>
        {folders.length === 0 ? (
          <p className="text-xs text-slate-500 px-2 py-1.5">No folders yet</p>
        ) : (
          <>
            {folders.map((f) => (
              <button
                key={f.id}
                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-slate-100 flex items-center gap-2 ${
                  promo.folderId === f.id ? 'font-medium text-slate-900' : 'text-slate-700'
                }`}
                onClick={(e) => {
                  e.preventDefault()
                  onMove(promo.id, f.id)
                  setOpen(false)
                }}
              >
                <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
            {promo.folderId && (
              <>
                <div className="my-1 border-t" />
                <button
                  className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-500 hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault()
                    onMove(promo.id, null)
                    setOpen(false)
                  }}
                >
                  Remove from folder
                </button>
              </>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
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

  const { isNewAccount, isLoading: bootstrapLoading } = useBootstrap()

  useEffect(() => {
    if (!bootstrapLoading && isNewAccount) {
      router.push('/onboarding')
    }
  }, [isNewAccount, bootstrapLoading, router])

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['promos'] })
      void queryClient.invalidateQueries({ queryKey: ['usage'] })
    },
  })

  function handlePromoCreated(promo: Promo) {
    void queryClient.invalidateQueries({ queryKey: ['promos'] })
    void queryClient.invalidateQueries({ queryKey: ['usage'] })
    void queryClient.invalidateQueries({ queryKey: ['folders'] })
  }

  const folders = foldersData?.data ?? []
  const promos = promosData?.data ?? []
  const usage = usageData?.data

  if (bootstrapLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Usage banner */}
      {usage && (
        <div className="mb-6 px-4 py-3 bg-slate-100 rounded-lg text-sm text-slate-600">
          <span className="font-medium text-slate-800">{usage.promosUsed}</span> of{' '}
          <span className="font-medium text-slate-800">{usage.promosLimit}</span> promos used this
          month
          {usage.promosUsed >= usage.promosLimit && (
            <span className="ml-2 text-amber-700 font-medium">— limit reached</span>
          )}
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

      {/* Main layout: sidebar + grid */}
      <div className="flex gap-6">
        {/* Folder sidebar */}
        <aside className="w-44 shrink-0 space-y-0.5">
          {/* All promos */}
          <div
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors ${
              activeFolderId === null
                ? 'bg-slate-200 text-slate-900 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            onClick={() => setActiveFolderId(null)}
          >
            <Folder className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="flex-1 min-w-0 truncate">All promos</span>
          </div>

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

          {/* New folder button */}
          {!addingFolder && (
            <button
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors mt-1"
              onClick={() => { setFolderError(null); setAddingFolder(true) }}
            >
              <Plus className="h-3.5 w-3.5" />
              New folder
            </button>
          )}
        </aside>

        {/* Promo grid */}
        <div className="flex-1 min-w-0">
          {promosLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {promos.map((promo) => (
                <Link key={promo.id} href={`/promos/${promo.id}`} className="block group">
                  <Card className="h-full transition-shadow group-hover:shadow-md cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold text-slate-900 leading-tight">
                          {promo.title}
                        </CardTitle>
                        <div className="flex items-center gap-1 shrink-0">
                          <MoveToFolder
                            promo={promo}
                            folders={folders}
                            onMove={(promoId, folderId) => movePromo.mutate({ promoId, folderId })}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); duplicatePromo.mutate(promo.id) }}
                              >
                                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Badge
                            className={`capitalize border ${statusVariant(promo.status)}`}
                            variant="outline"
                          >
                            {promo.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-slate-500 space-y-1">
                        {promo.itemCount != null && (
                          <p>
                            {promo.itemCount} {promo.itemCount === 1 ? 'item' : 'items'}
                          </p>
                        )}
                        <p>Created {formatDate(promo.createdAt)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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
