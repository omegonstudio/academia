export function ContentGap({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null
  return (
    <aside
      className="rounded-2xl border border-dashed border-border bg-surface-muted/60 px-5 py-4"
      aria-label="Contenidos pendientes"
    >
      <p className="text-sm font-semibold text-foreground">
        Contenidos o integraciones pendientes
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  )
}
