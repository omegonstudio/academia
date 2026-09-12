# Accessibility baseline

Target: **WCAG 2.2 AA**, treated as a build requirement rather than an audit
performed at the end.

## Token contrast

Every colour pair was measured before being adopted. Ratios below are computed
with the WCAG relative-luminance formula against the intended background.

| Foreground   | Background       | Ratio    | Required | Use                     |
| ------------ | ---------------- | -------- | -------- | ----------------------- |
| `ink`        | `surface`        | 17.60:1  | 4.5:1    | Body text               |
| `ink`        | `surface-muted`  | 16.42:1  | 4.5:1    | Text on cards           |
| `ink-muted`  | `surface`        | 6.54:1   | 4.5:1    | Secondary text          |
| `ink-muted`  | `surface-muted`  | 6.10:1   | 4.5:1    | Secondary text on cards |
| `brand`      | `surface`        | 8.56:1   | 4.5:1    | Links                   |
| `on-brand`   | `brand`          | 8.56:1   | 4.5:1    | Primary button label    |
| `on-brand`   | `brand-strong`   | 11.56:1  | 4.5:1    | Button hover label      |
| `danger`     | `surface`        | 7.26:1   | 4.5:1    | Error messages          |
| `danger`     | `surface-muted`  | 6.77:1   | 4.5:1    | Error on cards          |
| `success`    | `surface`        | 6.40:1   | 4.5:1    | Success messages        |
| `focus`      | `surface`        | 6.39:1   | 3:1      | Focus ring (non-text)   |

All pairs pass. Changing any token in `apps/web/src/app/globals.css` requires
re-running this check and updating the table.

## What is implemented

**Structure**

- `<html lang="es">` so assistive technology uses the right pronunciation (3.1.1).
- One `<h1>` per page via the shared `PageHeader`, with headings in order (1.3.1).
- Landmarks: `<header>`, `<nav>`, `<main id="contenido">`, `<footer>`.
- `<nav aria-label="Navegación principal">`, distinguishable from other navigation.

**Keyboard**

- A skip link is the first focusable element, visible only on focus (2.4.1).
- Nothing is reachable by mouse alone; every control is a real `<button>` or `<a>`.
- A single visible focus indicator — a 3 px ring with a 2 px offset — applied via
  `:focus-visible`. Focus is restyled, never removed (2.4.7, 2.4.11).

**Forms**

- Every input has an associated `<label for>`; no placeholder-as-label (1.3.1, 3.3.2).
- Errors are conveyed as text, not by colour alone (1.4.1).
- The login error carries `role="alert"` so it is announced on appearance, and is
  linked to both fields with `aria-describedby` (3.3.1, 4.1.3).
- Correct `autoComplete` values (`email`, `current-password`) so password managers
  and autofill work (1.3.5).
- The submit button reports progress as text and is disabled while pending.

**Motion and colour**

- `prefers-reduced-motion: reduce` collapses animations and transitions (2.3.3).
- `color-scheme: light` declared, so the browser does not auto-invert into
  unverified contrast.
- No information is carried by colour alone.

**Markup semantics**

- Course and profile data use `<dl>`/`<dt>`/`<dd>`; steps use `<ol>`.
- ARIA is used only where a native element cannot express the meaning.

## Checked for Stage 0

Verified against the running application:

- Keyboard-only traversal of `/`, `/about`, `/courses`, `/teachers`, `/contact`,
  `/login` reaches every control, skip link first.
- Focus is visible on every interactive element.
- The login form is operable and its error is announced.
- Token contrast measured as tabulated above.
- Heading order and single `<main>` landmark confirmed in the rendered HTML.

## Required for every new UI

Not optional, and not deferred to Stage 9:

1. Keyboard reachability and a visible focus indicator.
2. Labels on all inputs; errors as text.
3. Contrast checked against this table, adding new pairs to it.
4. Heading order preserved; exactly one `<h1>`.
5. Loading, empty, error and success states announced, not only drawn.
6. Touch targets large enough to be hit comfortably (2.5.8).
7. Dialogs manage focus: trap while open, restore on close.
8. No new ARIA where a native element exists.

## Deferred to Stage 9

- Screen-reader passes with NVDA/VoiceOver.
- Automated axe checks in CI.
- Core Web Vitals measurement.
- Full audit of the dashboard, which barely exists yet.
