import { site } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface-muted">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-ink-muted">
        <p>
          {site.name} — {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
