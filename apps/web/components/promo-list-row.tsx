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

interface PromoListRowProps {
  promo: Promo
  folders: PromoFolder[]
  onDuplicate: (id: string) => void
  onMove: (promoId: string, folderId: string | null) => void
  onDelete: (id: string) => void
}

function statusBadgeClass(status: string): string {
  if (status === 'ready') return 'bg-emerald-100 text-emerald-800'
  if (status === 'processing') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function PromoListRow({ promo, folders, onDuplicate, onMove, onDelete }: PromoListRowProps) {
  const router = useRouter()
  const [pendingDelete, setPendingDelete] = useState(false)

  function handleRowClick() {
    router.push(`/promos/${promo.id}`)
  }

  return (
    <>
      <div
        className="group flex items-center gap-4 px-3 py-2.5 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={handleRowClick}
      >
        {/* Thumbnail */}
        <div className="w-[40px] h-[53px] rounded-md overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
          {promo.previewUrl ? (
            <img src={promo.previewUrl} alt={promo.title} className="w-full h-full object-cover" />
          ) : (
            <FileImage className="h-5 w-5 text-slate-300" />
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{promo.title}</p>
        </div>

        {/* Status badge */}
        <div className="w-24 shrink-0">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(promo.status)}`}>
            {promo.status}
          </span>
        </div>

        {/* Item count */}
        <div className="w-20 text-right text-xs text-slate-500 shrink-0">
          {promo.itemCount != null ? `${promo.itemCount} ${promo.itemCount === 1 ? 'item' : 'items'}` : '—'}
        </div>

        {/* Date */}
        <div className="w-32 text-xs text-slate-500 shrink-0">
          {formatDate(promo.createdAt)}
        </div>

        {/* Actions */}
        <div className="w-9 flex justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-slate-200 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
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
