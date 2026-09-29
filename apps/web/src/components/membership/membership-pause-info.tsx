import { PauseCircle } from 'lucide-react'
import { Card } from '@/components/ui/primitives'

export function MembershipPauseInfo() {
  return (
    <section
      aria-labelledby="membership-pause-heading"
      className="mt-6 grid gap-4 lg:grid-cols-2"
    >
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PauseCircle className="size-5" aria-hidden />
          </span>
          <div>
            <h2
              id="membership-pause-heading"
              className="font-semibold tracking-tight"
            >
              ¿Necesitás hacer una pausa?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Podés pausar tu membresía durante 1 a 3 meses, una vez por año,
              conservando tu precio y tu progreso.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2
          id="membership-cancel-heading"
          className="font-semibold tracking-tight"
        >
          Cancelación
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          La cancelación es self-service. Al cancelar, se pierde el precio
          legacy y puede perderse el progreso asociado a la membresía.
        </p>
      </Card>
    </section>
  )
}
