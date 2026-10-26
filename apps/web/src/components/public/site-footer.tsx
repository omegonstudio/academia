import Link from 'next/link'
import { publicCta, publicNavLinks } from '@/lib/public-nav'
import { spanish2goContact } from '@/lib/spanish2go-public-content'

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Academia<span className="text-primary">.</span>
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Formación y comunidad para profes de español no nativos, con la
              propuesta educativa de Spanish2Go.
            </p>
          </div>
          <nav aria-label="Enlaces del pie" className="flex flex-col gap-2">
            {publicNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={publicCta.href}
              className="text-sm font-medium text-primary transition hover:underline"
            >
              {publicCta.label}
            </Link>
          </nav>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Contacto</p>
            <a
              href={`mailto:${spanish2goContact.email}`}
              className="mt-2 block transition hover:text-foreground"
            >
              {spanish2goContact.email}
            </a>
            <a
              href={`tel:${spanish2goContact.phoneTel}`}
              className="mt-1 block transition hover:text-foreground"
            >
              {spanish2goContact.phoneDisplay}
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Academia de Español — Omegon</p>
          <div className="flex gap-5">
            <Link href="/" className="transition hover:text-foreground">
              Inicio
            </Link>
            <Link href="/login" className="transition hover:text-foreground">
              Ingresar
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
