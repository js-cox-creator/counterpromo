import Handlebars from 'handlebars'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { TemplatePromoData } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b)

export function renderTemplate(templateId: string, data: TemplatePromoData): string {
  const templatePath = join(__dirname, `${templateId}.hbs`)
  const source = readFileSync(templatePath, 'utf8')
  const template = Handlebars.compile(source)
  return template(data)
}
