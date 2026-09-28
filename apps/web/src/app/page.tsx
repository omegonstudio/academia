'use client'

import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Globe2,
  Menu,
  MessageCircle,
  Play,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/primitives'

const modalities = [
  { icon: Users, title: 'Clases individuales', text: 'Un recorrido a tu medida, con objetivos concretos y acompañamiento cercano.', toneClass: 'bg-primary/10 text-primary' },
  { icon: Globe2, title: 'Clases grupales', text: 'Practicá en comunidad, compartí ideas y aprendé con personas de todo el mundo.', toneClass: 'bg-accent/12 text-accent' },
  { icon: BookOpen, title: 'Formación docente', text: 'Herramientas y práctica para llevar tu enseñanza del español un paso más allá.', toneClass: 'bg-secondary/25 text-secondary-foreground' },
]

const upcoming = [
  { day: '24', month: 'SEP', time: '10:00', title: 'Conversación B1', teacher: 'con Marina López', colorClass: 'bg-primary/10 text-primary' },
  { day: '25', month: 'SEP', time: '18:30', title: 'Español para viajar', teacher: 'con Tomás Silva', colorClass: 'bg-accent/12 text-accent' },
  { day: '27', month: 'SEP', time: '09:00', title: 'Gramática avanzada', teacher: 'con Ana Torres', colorClass: 'bg-secondary/25 text-secondary-foreground' },
]

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
          <a href="#inicio" className="flex items-center gap-3" aria-label="Academia, inicio">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Sparkles className="h-5 w-5" /></span>
            <span className="text-lg font-semibold tracking-tight">Academia<span className="text-primary">.</span></span>
          </a>
          <nav className={`${menuOpen ? 'absolute left-4 right-4 top-20 flex' : 'hidden'} flex-col gap-1 rounded-2xl border border-border bg-surface-elevated p-2 shadow-lg md:static md:flex md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
            <a href="#cursos" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface-muted hover:text-foreground">Cursos</a>
            <a href="#metodo" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface-muted hover:text-foreground">Cómo funciona</a>
            <a href="#academia" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface-muted hover:text-foreground">La academia</a>
            <a href="#contacto" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface-muted hover:text-foreground">Contacto</a>
            <div className="mt-2 flex items-center justify-between border-t border-border px-3 py-3 md:hidden"><span className="text-sm font-medium">Tema</span><ThemeToggle /></div>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex"><ThemeToggle /></div>
            <a href="/login" className="hidden rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover sm:inline-flex">Ingresar</a>
            <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </header>

        <section id="inicio" className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-32 lg:pt-24">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Aprendé, conectá, avanzá</div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.04] tracking-[-0.04em] md:text-7xl">Español para <span className="text-primary">comunicarte</span> de verdad.</h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Una academia contemporánea para aprender español con confianza, propósito y una comunidad que te acompaña.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><a href="#cursos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover">Conocé nuestros cursos <ArrowRight className="h-4 w-4" /></a><a href="#metodo" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3.5 text-sm font-medium transition hover:bg-surface-muted"><Play className="h-4 w-4 fill-current text-accent" /> Cómo funciona</a></div>
            <div className="mt-10 flex items-center gap-4 text-sm text-muted-foreground"><div className="flex -space-x-2"><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-medium text-primary-foreground">ML</span><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-accent text-xs font-medium text-accent-foreground">TS</span><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-secondary text-xs font-medium text-secondary-foreground">AT</span></div><span>Una comunidad de estudiantes reales</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-[2rem] border border-border bg-surface p-3 shadow-[0_24px_80px_-28px_rgba(170,21,27,.35)]"><div className="rounded-[1.5rem] bg-surface-muted p-5 sm:p-7"><div className="mb-8 flex items-start justify-between"><div><p className="text-xs font-medium uppercase tracking-[.15em] text-muted-foreground">Tu espacio</p><p className="mt-2 text-2xl font-semibold tracking-tight">Hola, Sofía</p></div><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">SC</span></div><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-medium">Próximas clases</p><p className="mt-1 text-xs text-muted-foreground">Tu semana en un vistazo</p></div><CalendarDays className="h-5 w-5 text-primary" /></div><div className="space-y-3">{upcoming.map((item) => <div key={item.title} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"><div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg ${item.colorClass}`}><span className="text-base font-semibold leading-none">{item.day}</span><span className="mt-1 text-[9px] font-medium">{item.month}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.teacher}</p></div><div className="text-right"><p className="text-sm font-medium">{item.time}</p><Clock3 className="ml-auto mt-1 h-3.5 w-3.5 text-muted-foreground" /></div></div>)}</div><div className="mt-5 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground"><div><p className="text-xs opacity-80">Tu progreso</p><p className="mt-1 text-sm font-medium">Nivel B1 en curso</p></div><div className="text-right"><p className="text-lg font-semibold">68%</p><div className="mt-1 h-1.5 w-16 rounded-full bg-primary-foreground/25"><div className="h-full w-2/3 rounded-full bg-primary-foreground" /></div></div></div></div></div><div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg sm:flex"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success"><Check className="h-4 w-4" /></span><div><p className="text-xs font-semibold">Objetivo cumplido</p><p className="text-xs text-muted-foreground">¡Excelente trabajo!</p></div></div></div>
        </section>
      </div>

      <section id="cursos" className="border-y border-border bg-surface py-20 lg:py-24"><div className="mx-auto max-w-6xl px-5 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold text-primary">Elegí tu forma de aprender</p><h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Un camino que se adapta a vos.</h2><p className="mt-4 leading-7 text-muted-foreground">Porque cada persona aprende distinto, creamos experiencias que combinan estructura, práctica y conversaciones reales.</p></div><div className="mt-12 grid gap-5 md:grid-cols-3">{modalities.map((item) => { const Icon = item.icon; return <article key={item.title} className="group rounded-2xl border border-border bg-background p-6 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.toneClass}`}><Icon className="h-5 w-5" /></span><h3 className="mt-6 text-lg font-semibold">{item.title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p><a href="#contacto" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">Conocer más <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></a></article> })}</div></div></section>

      <section id="metodo" className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-28"><div><p className="text-sm font-semibold text-primary">Cómo funciona</p><h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Aprender puede sentirse simple.</h2><p className="mt-5 leading-7 text-muted-foreground">Te acompañamos desde tu primer diagnóstico hasta cada conversación que te haga sentir más seguro.</p><a href="#contacto" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-primary">Empezá tu recorrido <ArrowRight className="h-4 w-4" /></a></div><div className="grid gap-4 sm:grid-cols-3">{[['01','Conocé tu nivel','Una primera charla para entender tus objetivos.'],['02','Elegí tu ritmo','Encontrá la modalidad y el horario que mejor te quedan.'],['03','Usá el idioma','Practicá con situaciones reales desde el primer día.']].map(([n,t,d]) => <div key={n} className="border-l-2 border-primary/20 pl-5"><span className="text-sm font-semibold text-accent">{n}</span><h3 className="mt-4 font-semibold">{t}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{d}</p></div>)}</div></section>

      <section id="academia" className="bg-primary py-16 text-primary-foreground lg:py-20"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 sm:flex-row sm:items-center lg:px-8"><div><p className="text-sm font-medium text-primary-foreground/70">Academia de Español — Omegon</p><h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">Tu próxima conversación empieza acá.</h2></div><a href="#contacto" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface px-5 py-3.5 text-sm font-medium text-foreground transition hover:bg-surface-muted">Hablemos <MessageCircle className="h-4 w-4" /></a></div></section>

      <footer id="contacto" className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>© 2026 Academia de Español — Omegon</p><div className="flex gap-5"><a href="#inicio" className="transition hover:text-foreground">Volver arriba</a><a href="#ingresar" className="transition hover:text-foreground">Ingresar</a></div></footer>
    </main>
  )
}

