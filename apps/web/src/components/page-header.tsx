import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  intro?: string;
  children?: ReactNode;
}

/**
 * The single `<h1>` of a page plus its supporting text, so heading order stays
 * consistent across routes (WCAG 1.3.1).
 */
export function PageHeader({ title, intro, children }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      {intro ? (
        <p className="mt-3 max-w-2xl text-lg text-ink-muted">{intro}</p>
      ) : null}
      {children}
    </header>
  );
}
