export function FormFieldError({
  errors,
  name,
}: {
  errors?: Record<string, string[] | undefined>
  name: string
}) {
  const first = errors?.[name]?.[0]
  if (!first) return null
  return <p className="text-sm text-destructive">{first}</p>
}
