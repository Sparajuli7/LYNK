import catalogData from '@/data/bet_templates.json'
import type { BetTemplate, BetCategory } from './types'

const templates: BetTemplate[] = (catalogData as { templates: BetTemplate[] }).templates

let _byCategory: Map<BetCategory, BetTemplate[]> | null = null

function indexByCategory(): Map<BetCategory, BetTemplate[]> {
  if (_byCategory) return _byCategory
  _byCategory = new Map()
  for (const t of templates) {
    const list = _byCategory.get(t.category) ?? []
    list.push(t)
    _byCategory.set(t.category, list)
  }
  return _byCategory
}

export function getAllTemplates(): BetTemplate[] {
  return templates
}

export function getTemplateById(id: string): BetTemplate | undefined {
  return templates.find((t) => t.id === id)
}

export function getTemplatesByCategory(category: BetCategory): BetTemplate[] {
  return indexByCategory().get(category) ?? []
}

export function searchTemplates(query: string): BetTemplate[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return templates

  return templates.filter((t) => {
    const haystack = `${t.title} ${t.category} ${t.subcategory ?? ''} ${t.tags.join(' ')}`.toLowerCase()
    return words.some((w) => haystack.includes(w))
  })
}

/** Replace {key} slots with their default values in a template title */
export function resolveTitle(template: BetTemplate): string {
  let text = template.title
  if (template.templateSlots) {
    for (const slot of template.templateSlots) {
      text = text.replace(`{${slot.key}}`, String(slot.default))
    }
  }
  return text
}

export function getCatalogStats() {
  const byCategory = indexByCategory()
  return {
    total: templates.length,
    categories: Object.fromEntries(
      [...byCategory.entries()].map(([cat, list]) => [cat, list.length]),
    ),
    matureCount: templates.filter((t) => t.matureFlag).length,
    templatedCount: templates.filter((t) => t.templateSlots && t.templateSlots.length > 0).length,
  }
}
