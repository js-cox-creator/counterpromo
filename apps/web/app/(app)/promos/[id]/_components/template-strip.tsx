'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { apiClient, type CustomTemplate } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface TemplateDefinition {
  id: string
  label: string
  description: string
}

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'multi-product', label: 'Multi-Product Flyer', description: '3-col product grid · brand colours · logo header' },
]

// ---------------------------------------------------------------------------
// Mini SVG thumbnail
// ---------------------------------------------------------------------------

function TemplateThumbnail({ id }: { id: string }) {
  // All colours are neutral — the real render uses the account's brand colours
  const accent = '#475569'   // slate-600 placeholder
  const muted = '#e2e8f0'    // slate-200 placeholder
  const bg = '#f8fafc'

  if (id === 'multi-product') {
    return (
      <svg viewBox="0 0 60 80" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Page bg */}
        <rect width="60" height="80" fill={bg} />

        {/* Header band */}
        <rect x="0" y="0" width="4" height="80" fill={accent} opacity="0.6" />
        <rect x="4" y="0" width="56" height="16" fill={accent} />
        {/* Logo placeholder */}
        <rect x="7" y="4" width="14" height="8" rx="1" fill="white" opacity="0.25" />
        {/* Title lines */}
        <rect x="27" y="5" width="28" height="3.5" rx="0.5" fill="white" opacity="0.9" />
        <rect x="33" y="10" width="22" height="2" rx="0.5" fill="white" opacity="0.55" />

        {/* 3×3 product grid */}
        {[0, 1, 2].flatMap((col) =>
          [0, 1, 2].map((row) => {
            const x = 4 + col * 19
            const y = 19 + row * 18
            return (
              <g key={`${col}-${row}`}>
                {/* Card bg */}
                <rect x={x} y={y} width="17" height="16" rx="0.8" fill="white" stroke={muted} strokeWidth="0.4" />
                {/* Top accent strip */}
                <rect x={x} y={y} width="17" height="1.5" rx="0.4" fill={accent} opacity="0.7" />
                {/* Image area */}
                <rect x={x + 1.5} y={y + 2.5} width="14" height="6" rx="0.4" fill={muted} />
                {/* Price line */}
                <rect x={x + 1.5} y={y + 10} width="8" height="2" rx="0.3" fill={accent} opacity="0.8" />
                {/* Name line */}
                <rect x={x + 1.5} y={y + 13} width="12" height="1.2" rx="0.3" fill="#94a3b8" opacity="0.6" />
              </g>
            )
          })
        )}

        {/* Footer band */}
        <rect x="0" y="74" width="4" height="6" fill={accent} opacity="0.6" />
        <rect x="4" y="74" width="56" height="6" fill={accent} />
        <rect x="7" y="76" width="12" height="2" rx="0.3" fill="white" opacity="0.7" />
        <rect x="42" y="76" width="14" height="2" rx="0.3" fill="white" opacity="0.5" />
      </svg>
    )
  }

  return <div className="w-full h-full bg-slate-100" />
}

function CustomTemplateThumbnail() {
  const accent = '#6366f1'
  const muted = '#e0e7ff'
  const bg = '#f8fafc'
  return (
    <svg viewBox="0 0 60 80" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="80" fill={bg} />
      <rect x="0" y="0" width="60" height="14" fill={accent} opacity="0.85" />
      <rect x="4" y="4" width="20" height="6" rx="1" fill="white" opacity="0.3" />
      <rect x="28" y="5" width="28" height="3" rx="0.5" fill="white" opacity="0.7" />
      {[0,1,2].map((i) => (
        <g key={i}>
          <rect x={4 + i * 19} y={18} width="17" height="24" rx="1" fill="white" stroke={muted} strokeWidth="0.5" />
          <rect x={4 + i * 19} y={18} width="17" height="2" rx="0.5" fill={accent} opacity="0.5" />
          <rect x={5.5 + i * 19} y={22} width="14" height="11" rx="0.5" fill={muted} />
          <rect x={5.5 + i * 19} y={35} width="9" height="2" rx="0.3" fill={accent} opacity="0.7" />
          <rect x={5.5 + i * 19} y={38} width="12" height="1.5" rx="0.3" fill="#94a3b8" opacity="0.5" />
        </g>
      ))}
      <rect x="4" y="48" width="52" height="10" rx="1" fill={muted} />
      <rect x="4" y="62" width="52" height="6" rx="1" fill={muted} opacity="0.5" />
      <rect x="0" y="74" width="60" height="6" fill={accent} opacity="0.85" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// TemplateStrip
// ---------------------------------------------------------------------------

interface TemplateStripProps {
  selectedTemplate: string
  templateSaving: boolean
  onTemplateSelect: (id: string) => void
  // filter props kept for API compatibility but unused while there's only one template
  categoryFilter?: string
  countFilter?: string
  pagesFilter?: string
  onCategoryChange?: (v: string) => void
  onCountChange?: (v: string) => void
  onPagesChange?: (v: string) => void
}

export function TemplateStrip({
  selectedTemplate,
  templateSaving,
  onTemplateSelect,
}: TemplateStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { getToken } = useAuth()

  const { data: customTemplatesData } = useQuery({
    queryKey: ['custom-templates'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).customTemplates.list()
    },
  })
  const customTemplates: CustomTemplate[] = customTemplatesData?.data ?? []

  const allCount = TEMPLATES.length + customTemplates.length

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="border-b border-slate-200 bg-white shrink-0">
      <div className="relative px-8 py-3">
        {allCount > 4 && (
          <button
            type="button"
            onClick={() => scrollBy(-280)}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth items-start"
          style={{ scrollbarWidth: 'none' }}
        >
          {TEMPLATES.map((tpl) => {
            const isSelected = selectedTemplate === tpl.id || (selectedTemplate === '' && tpl.id === TEMPLATES[0]?.id)
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onTemplateSelect(tpl.id)}
                title={tpl.description}
                className={cn(
                  'flex-none flex items-center gap-3 rounded-lg border overflow-hidden cursor-pointer transition-all',
                  isSelected
                    ? 'ring-2 ring-blue-500 border-blue-400 shadow-md bg-blue-50/30'
                    : 'border-slate-200 hover:border-slate-400 hover:shadow-md bg-white',
                )}
              >
                {/* Thumbnail */}
                <div className="w-[60px] h-[80px] relative bg-slate-50 shrink-0 overflow-hidden">
                  <TemplateThumbnail id={tpl.id} />
                  {isSelected && (
                    <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                {/* Label + description */}
                <div className="pr-4 text-left">
                  <p className={cn('text-sm font-semibold', isSelected ? 'text-blue-600' : 'text-slate-800')}>
                    {tpl.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{tpl.description}</p>
                </div>
              </button>
            )
          })}

          {customTemplates.map((tpl) => {
            const isSelected = selectedTemplate === tpl.id
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onTemplateSelect(tpl.id)}
                title={tpl.description ?? tpl.name}
                className={cn(
                  'flex-none flex items-center gap-3 rounded-lg border overflow-hidden cursor-pointer transition-all',
                  isSelected
                    ? 'ring-2 ring-blue-500 border-blue-400 shadow-md bg-blue-50/30'
                    : 'border-slate-200 hover:border-slate-400 hover:shadow-md bg-white',
                )}
              >
                <div className="w-[60px] h-[80px] relative bg-slate-50 shrink-0 overflow-hidden">
                  <CustomTemplateThumbnail />
                  {isSelected && (
                    <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="pr-4 text-left">
                  <p className={cn('text-sm font-semibold', isSelected ? 'text-blue-600' : 'text-slate-800')}>
                    {tpl.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{tpl.isSystem ? 'System' : 'Custom'}</p>
                </div>
              </button>
            )
          })}

          {templateSaving && (
            <span className="self-center text-xs text-slate-400 ml-2 shrink-0">Saving…</span>
          )}
        </div>

        {allCount > 4 && (
          <button
            type="button"
            onClick={() => scrollBy(280)}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          </button>
        )}
      </div>
    </div>
  )
}
