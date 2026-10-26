import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { FeaturedCourses } from '@/components/public/featured-courses'
import { PublicSiteFooter } from '@/components/public/site-footer'
import { PublicSiteHeader } from '@/components/public/site-header'
import { publicCta } from '@/lib/public-nav'
import { site } from '@/lib/site'
import {
  blabla2go,
  educationalPills,
  freeAdvisory,
  homeValueProp,
  mentorship,
  nonNativeTeachers,
  onlineCoursesOffer,
} from '@/lib/spanish2go-public-content'

export const metadata: Metadata = {
  title: site.name,
  description:
    'Formación y comunidad para profes de español no nativos: cursos online, recursos, mentorías, Blabla2Go y asesoría gratuita.',
  openGraph: {
    title: site.name,
    description:
      'Formación y comunidad para profes de español no nativos: cursos online, recursos, mentorías y Blabla2Go.',
    locale: site.locale,
    type: 'website',
  },
}

const offerSections = [
  {
    id: 'profesores-no-nativos',
    href: '/profesores-no-nativos',
    eyebrow: 'Formación docente',
    title: nonNativeTeachers.title,
    text: nonNativeTeachers.lead,
  },
  {
    id: 'cursos-online',
    href: '/cursos',
    eyebrow: 'A tu ritmo',
    title: onlineCoursesOffer.title,
    text: onlineCoursesOffer.lead,
  },
  {
    id: 'pildoras',
    href: '/pildoras-educativas',
    eyebrow: 'Recursos cortos',
    title: educationalPills.title,
    text: educationalPills.namingNote,
  },
  {
    id: 'mentorias',
    href: '/mentorias',
    eyebrow: '1:1',
    title: mentorship.title,
    text: mentorship.lead,
  },
  {
    id: 'blabla2go',
    href: '/blabla2go',
    eyebrow: 'Club de debate',
    title: blabla2go.title,
    text: blabla2go.lead,
  },
] as const

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <PublicSiteHeader activePath="/" />

        <section
          id="inicio"
          className="relative mx-auto max-w-6xl px-5 pb-20 pt-14 lg:px-8 lg:pb-28 lg:pt-20"
          aria-labelledby="home-hero-heading"
        >
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {homeValueProp.eyebrow}
          </p>
          <h1
            id="home-hero-heading"
            className="max-w-3xl text-balance text-5xl font-semibold leading-[1.04] tracking-[-0.04em] md:text-7xl"
          >
            {homeValueProp.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {homeValueProp.lead}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href={publicCta.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:opacity-90"
            >
              {publicCta.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/cursos"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3.5 text-sm font-medium transition hover:bg-surface-muted"
            >
              Ver cursos online
            </Link>
          </div>
        </section>
      </div>

      {offerSections.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          className={
            index % 2 === 0
              ? 'border-y border-border bg-surface py-16 lg:py-20'
              : 'py-16 lg:py-20'
          }
          aria-labelledby={`${section.id}-heading`}
        >
          <div className="mx-auto max-w-6xl px-5 lg:px-8">
            <p className="text-sm font-semibold text-primary">{section.eyebrow}</p>
            <h2
              id={`${section.id}-heading`}
              className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl"
            >
              {section.title}
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              {section.text}
            </p>
            <Link
              href={section.href}
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              Conocer más
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      ))}

      <FeaturedCourses />

      <section
        id="asesoria"
        className="bg-primary py-16 text-primary-foreground lg:py-20"
        aria-labelledby="asesoria-home-heading"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 sm:flex-row sm:items-center lg:px-8">
          <div>
            <p className="text-sm font-medium text-primary-foreground/70">
              {freeAdvisory.title}
            </p>
            <h2
              id="asesoria-home-heading"
              className="mt-2 max-w-xl text-3xl font-semibold tracking-tight md:text-4xl"
            >
              Empezá con una sesión de 30 minutos
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/80">
              {freeAdvisory.lead}
            </p>
          </div>
          <Link
            href={publicCta.href}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface px-5 py-3.5 text-sm font-medium text-foreground transition hover:bg-surface-muted"
          >
            {publicCta.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <PublicSiteFooter />
    </main>
  )
}
