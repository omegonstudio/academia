import Link from 'next/link';
import { site } from '@/lib/site';

const NAV_ITEMS = [
  { href: '/courses', label: 'Cursos' },
  { href: '/teachers', label: 'Docentes' },
  { href: '/about', label: 'La academia' },
  { href: '/contact', label: 'Contacto' },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link
          href="/"
          className="text-lg font-semibold text-brand hover:text-brand-strong"
        >
          {site.shortName}
        </Link>

        {/* Labelled so screen-reader users can distinguish it from other navs. */}
        <nav aria-label="Navegación principal">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-ink hover:text-brand hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/login"
                className="rounded-md bg-brand px-3 py-2 font-medium text-on-brand hover:bg-brand-strong"
              >
                Ingresar
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
