'use client'

import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { apiClient, type CustomTemplate } from '@/lib/api'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Built-in template definitions
// ---------------------------------------------------------------------------

export interface TemplateDefinition {
  id: string
  label: string
  description: string
}

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'multi-product', label: 'Multi-Product Flyer', description: '3-col product grid · brand colours · logo header' },
]

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

function BuiltinThumbnail({ id }: { id: string }) {
  const accent = '#475569'
  const muted = '#e2e8f0'
  const bg = '#f8fafc'

  if (id === 'multi-product') {
    return (
      <svg viewBox="0 0 60 80" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="60" height="80" fill={bg} />
        <rect x="0" y="0" width="4" height="80" fill={accent} opacity="0.6" />
        <rect x="4" y="0" width="56" height="16" fill={accent} />
        <rect x="7" y="4" width="14" height="8" rx="1" fill="white" opacity="0.25" />
        <rect x="27" y="5" width="28" height="3.5" rx="0.5" fill="white" opacity="0.9" />
        <rect x="33" y="10" width="22" height="2" rx="0.5" fill="white" opacity="0.55" />
        {[0, 1, 2].flatMap((col) =>
          [0, 1, 2].map((row) => {
            const x = 4 + col * 19
            const y = 19 + row * 18
            return (
              <g key={`${col}-${row}`}>
                <rect x={x} y={y} width="17" height="16" rx="0.8" fill="white" stroke={muted} strokeWidth="0.4" />
                <rect x={x} y={y} width="17" height="1.5" rx="0.4" fill={accent} opacity="0.7" />
                <rect x={x + 1.5} y={y + 2.5} width="14" height="6" rx="0.4" fill={muted} />
                <rect x={x + 1.5} y={y + 10} width="8" height="2" rx="0.3" fill={accent} opacity="0.8" />
                <rect x={x + 1.5} y={y + 13} width="12" height="1.2" rx="0.3" fill="#94a3b8" opacity="0.6" />
              </g>
            )
          })
        )}
        <rect x="0" y="74" width="4" height="6" fill={accent} opacity="0.6" />
        <rect x="4" y="74" width="56" height="6" fill={accent} />
        <rect x="7" y="76" width="12" height="2" rx="0.3" fill="white" opacity="0.7" />
        <rect x="42" y="76" width="14" height="2" rx="0.3" fill="white" opacity="0.5" />
      </svg>
    )
  }

  return <div className="w-full h-full bg-slate-100" />
}

function CustomThumbnail() {
  const accent = '#6366f1'
  const muted = '#e0e7ff'
  const bg = '#f8fafc'
  return (
    <svg viewBox="0 0 60 80" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="80" fill={bg} />
      <rect x="0" y="0" width="60" height="14" fill={accent} opacity="0.85" />
      <rect x="4" y="4" width="20" height="6" rx="1" fill="white" opacity="0.3" />
      <rect x="28" y="5" width="28" height="3" rx="0.5" fill="white" opacity="0.7" />
      {[0, 1, 2].map((i) => (
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
// TemplateSelector
// ---------------------------------------------------------------------------

interface TemplateSelectorProps {
  selected: string
  onSelect: (id: string) => void
}

export function TemplateSelector({ selected, onSelect }: TemplateSelectorProps) {
  const { getToken } = useAuth()

  const { data: customTemplatesData } = useQuery({
    queryKey: ['custom-templates'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).customTemplates.list()
    },
  })
  const customTemplates: CustomTemplate[] = customTemplatesData?.data ?? []

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {TEMPLATES.map((tpl) => {
        const isSelected = selected === tpl.id || (selected === '' && tpl.id === 'multi-product')
        return (
          <TemplateCard
            key={tpl.id}
            isSelected={isSelected}
            onClick={() => onSelect(tpl.id)}
            thumbnail={<BuiltinThumbnail id={tpl.id} />}
            label={tpl.label}
            badge={null}
            description={tpl.description}
          />
        )
      })}

      {customTemplates.map((tpl) => {
        const isSelected = selected === tpl.id
        return (
          <TemplateCard
            key={tpl.id}
            isSelected={isSelected}
            onClick={() => onSelect(tpl.id)}
            thumbnail={<CustomThumbnail />}
            label={tpl.name}
            badge={tpl.isSystem ? 'System' : 'Custom'}
            description={tpl.description ?? ''}
          />
        )
      })}
    </div>
  )
}

interface TemplateCardProps {
  isSelected: boolean
  onClick: () => void
  thumbnail: React.ReactNode
  label: string
  badge: string | null
  description: string
}

function TemplateCard({ isSelected, onClick, thumbnail, label, badge, description }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col rounded-lg border overflow-hidden cursor-pointer transition-all text-left',
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-400 shadow-md'
          : 'border-slate-200 hover:border-slate-400 hover:shadow-md bg-white',
      )}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-[3/4] bg-slate-50 overflow-hidden">
        {thumbnail}
        {isSelected && (
          <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
              <Check className="h-4 w-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="px-3 py-2 bg-white border-t border-slate-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={cn('text-xs font-semibold truncate flex-1', isSelected ? 'text-blue-600' : 'text-slate-800')}>
            {label}
          </p>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{badge}</span>
          )}
        </div>
        {description && (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{description}</p>
        )}
      </div>
    </button>
  )
}
