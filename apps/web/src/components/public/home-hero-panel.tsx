import {
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  GraduationCap,
  MessageCircle,
  Sparkles,
} from 'lucide-react'

/**
 * Decorative hero panel inspired by the original Home composition on `main`.
 * Illustrates the teacher-oriented commercial offer — not live product data.
 */
const spotlightItems = [
  {
    day: '03',
    month: 'NOV',
    time: '18:00',
    title: 'Encuentro de comunidad',
    detail: 'Blabla2Go · sesión guiada',
    tone: 'primary' as const,
  },
  {
    day: '05',
    month: 'NOV',
    time: '10:30',
    title: 'Mentoría individual',
    detail: 'Acompañamiento 1:1',
    tone: 'accent' as const,
  },
  {
    day: '08',
    month: 'NOV',
    time: 'A tu ritmo',
    title: 'Recurso educativo',
    detail: 'Píldora · debate en clase',
    tone: 'secondary' as const,
  },
] as const

function toneClasses(tone: 'primary' | 'accent' | 'secondary') {
  if (tone === 'accent') return 'bg-accent/10 text-accent'
  if (tone === 'secondary') return 'bg-secondary/10 text-secondary'
  return 'bg-primary/10 text-primary'
}

export function HomeHeroPanel() {
  return (
    <div
      className="relative mx-auto w-full max-w-md lg:max-w-none"
      aria-hidden="true"
    >
      <div className="rounded-[2rem] border border-border bg-surface p-3 shadow-[0_24px_80px_-28px_color-mix(in_oklab,var(--primary)_35%,transparent)]">
        <div className="rounded-[1.5rem] bg-surface-muted p-5 sm:p-7">
          <div className="mb-8 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Tu espacio docente
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                Hola, profe
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-medium">Formación docente</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cursos a tu ritmo
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <MessageCircle className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-medium">Mentorías</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Acompañamiento 1:1
              </p>
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Próximos encuentros</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Comunidad y recursos
              </p>
            </div>
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>

          <div className="space-y-3">
            {spotlightItems.map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg ${toneClasses(item.tone)}`}
                >
                  <span className="text-base font-semibold leading-none">
                    {item.day}
                  </span>
                  <span className="mt-1 text-[9px] font-medium">
                    {item.month}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{item.time}</p>
                  <Clock3 className="ml-auto mt-1 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-xs opacity-80">Progreso de aprendizaje</p>
              <p className="mt-1 text-sm font-medium">Formación en curso</p>
            </div>
            <div className="text-right">
              <p className="inline-flex items-center gap-1 text-lg font-semibold">
                <Sparkles className="h-4 w-4" />
                72%
              </p>
              <div className="mt-1 h-1.5 w-16 rounded-full bg-primary-foreground/25">
                <div className="h-full w-3/4 rounded-full bg-primary-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg sm:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
          <Check className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold">Recurso listo para clase</p>
          <p className="text-xs text-muted-foreground">Idea aplicada hoy</p>
        </div>
      </div>
    </div>
  )
}
