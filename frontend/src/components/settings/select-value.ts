/** Unwraps `{ value, label }` objects from Settings Select onValueChange. */
export function selectString(v: unknown): string | undefined {
  if (!v || typeof v !== "object" || !("value" in v)) return undefined
  const value = (v as { value: unknown }).value
  return typeof value === "string" ? value : undefined
}

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
