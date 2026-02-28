'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileImage, MoreHorizontal, Copy, FolderInput, Trash2, ExternalLink, Folder } from 'lucide-react'
import { type Promo, type PromoFolder } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

interface PromoCardProps {
  promo: Promo
  folders: PromoFolder[]
  onDuplicate: (id: string) => void
  onMove: (promoId: string, folderId: string | null) => void
  onDelete: (id: string) => void
}

function statusBadgeClass(status: string): string {
  if (status === 'ready') return 'bg-emerald-500/90 text-white'
  if (status === 'processing') return 'bg-amber-500/90 text-white'
  return 'bg-slate-700/80 text-slate-100'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function PromoCard({ promo, folders, onDuplicate, onMove, onDelete }: PromoCardProps) {
  const router = useRouter()
  const [pendingDelete, setPendingDelete] = useState(false)

  function handleCardClick() {
    router.push(`/promos/${promo.id}`)
  }

  return (
    <>
      <div
        className="group relative flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden cursor-pointer hover:shadow-lg hover:border-slate-300 transition-all duration-200"
        onClick={handleCardClick}
      >
        {/* Thumbnail */}
        <div className="relative w-full aspect-[3/4] bg-slate-100 overflow-hidden">
          {promo.previewUrl ? (
            <img
              src={promo.previewUrl}
              alt={promo.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <FileImage className="h-10 w-10 text-slate-300" />
              <span className="text-xs text-slate-400">No preview</span>
            </div>
          )}

          {/* Status badge */}
          <span
            className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase backdrop-blur-sm ${statusBadgeClass(promo.status)}`}
          >
            {promo.status}
          </span>

          {/* Hover scrim */}
          <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors duration-200 pointer-events-none" />

          {/* Action bar — slides up on hover */}
          <div className="absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-gradient-to-t from-slate-900/60 to-transparent flex justify-end px-2 py-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 rounded-md bg-white/20 hover:bg-white/40 text-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/promos/${promo.id}`) }}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(promo.id) }}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                    <FolderInput className="h-3.5 w-3.5 mr-2" /> Move to folder
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {folders.length === 0 ? (
                      <p className="text-xs text-slate-500 px-2 py-1.5">No folders yet</p>
                    ) : (
                      <>
                        {folders.map((f) => (
                          <DropdownMenuItem
                            key={f.id}
                            className={promo.folderId === f.id ? 'font-medium' : ''}
                            onClick={(e) => { e.stopPropagation(); onMove(promo.id, f.id) }}
                          >
                            <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </DropdownMenuItem>
                        ))}
                        {promo.folderId && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-slate-500"
                              onClick={(e) => { e.stopPropagation(); onMove(promo.id, null) }}
                            >
                              Remove from folder
                            </DropdownMenuItem>
                          </>
                        )}
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(true) }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Metadata strip */}
        <div className="px-3 pt-2.5 pb-3">
          <p className="text-sm font-semibold text-slate-900 truncate">{promo.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {promo.itemCount != null ? `${promo.itemCount} ${promo.itemCount === 1 ? 'item' : 'items'} · ` : ''}
            {formatDate(promo.createdAt)}
          </p>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete promo?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{promo.title}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onDelete(promo.id); setPendingDelete(false) }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
