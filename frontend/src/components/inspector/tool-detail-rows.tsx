import { cn } from "@/lib/utils"

/** PathRow renders the target path as a prominent mono row. */
export function PathRow({ path }: { path: string }) {
  if (!path) return null
  return (
    <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">
      {path}
    </p>
  )
}

/** NoteLine renders small meta text (truncated, counts…). */
export function NoteLine({
  children,
  tone = "muted",
}: {
  children: string
  tone?: "muted" | "warning"
}) {
  return (
    <p
      className={cn(
        "text-[11px]",
        tone === "warning" ? "text-warning" : "text-muted-foreground"
      )}
    >
      {children}
    </p>
  )
}
