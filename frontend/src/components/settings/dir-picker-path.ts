export function breadcrumbs(path: string): { label: string; path: string }[] {
  if (!path) return []
  const parts = path.split("/").filter(Boolean)
  const crumbs: { label: string; path: string }[] = []
  let acc = ""
  for (const p of parts) {
    acc += "/" + p
    crumbs.push({ label: p, path: acc })
  }
  return crumbs
}
