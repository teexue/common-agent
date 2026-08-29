export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {error}
    </p>
  )
}

export function FormOk({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
      {message}
    </p>
  )
}
