import type { TemplateDefinition } from './types.js'

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'multi-product', name: 'Multi-Product Flyer', description: '3-column product grid with brand colours, logo header, and branch footer', previewBgColor: '#1a3a5c', category: 'general' },
]

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]!
}
