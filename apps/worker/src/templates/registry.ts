import type { TemplateDefinition } from './types.js'

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'classic', name: 'Classic Grid', description: 'Clean grid layout with logo header', previewBgColor: '#1a1a2e', category: 'general' },
  { id: 'modern', name: 'Modern Stripe', description: 'Bold color stripe with product cards', previewBgColor: '#e94560', category: 'general' },
  { id: 'bold', name: 'Bold Promo', description: 'High-contrast promotional layout', previewBgColor: '#16213e', category: 'general' },
  { id: 'monthly-specials', name: 'Monthly Specials', description: 'List-style flyer with price emphasis', previewBgColor: '#2d5a27', category: 'seasonal' },
  { id: 'vendor-spotlight', name: 'Vendor Spotlight', description: '2-column layout with vendor branding', previewBgColor: '#1a3a5c', category: 'vendor' },
  { id: 'clearance', name: 'Clearance Event', description: 'High-impact sale layout with badges', previewBgColor: '#8b0000', category: 'clearance' },
]

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]!
}
