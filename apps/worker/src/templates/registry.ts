import type { TemplateDefinition } from './types.js'

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'classic', name: 'Classic Grid', description: 'Clean grid layout with logo header', previewBgColor: '#1a1a2e' },
  { id: 'modern', name: 'Modern Stripe', description: 'Bold color stripe with product cards', previewBgColor: '#e94560' },
  { id: 'bold', name: 'Bold Promo', description: 'High-contrast promotional layout', previewBgColor: '#16213e' },
]

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]!
}
