/** Tools implied by another tool; hidden from picker / permission UI. */
export const HIDDEN_PICKER_TOOLS = new Set(["read_image"])

/** Drops hidden implied tools from name lists. */
export function stripHiddenPickerTools(names: string[]): string[] {
  return names.filter((n) => !HIDDEN_PICKER_TOOLS.has(n))
}

/** Filters catalog tools for the agent editor picker. */
export function visibleCatalogTools<T extends { name: string }>(
  tools: T[]
): T[] {
  return tools.filter((tool) => !HIDDEN_PICKER_TOOLS.has(tool.name))
}
