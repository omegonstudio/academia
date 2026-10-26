# Oferta comercial pública Spanish2Go → Academia

**Fecha de captura:** 2026-10-16  
**Método:** lectura pública de `spanish2go.online` + landings ya citadas en los JSON de cursos + posts públicos LinkedIn de Sara (Blabla2Go).  
**Autenticación:** no  
**Descarga de assets:** no  

Este documento complementa `INVENTARIO_Y_COBERTURA.md` (estructura LMS).  
Solo se registran afirmaciones verificables en fuentes públicas. Lo no encontrado queda marcado como **PENDIENTE**.

---

## Contacto público (fuente)

| Campo | Valor | Fuente |
|---|---|---|
| Email | `info@spanish2go.online` | Home, Contacto, landings |
| Teléfono | `+34 675 077 589` | Home, Contacto |
| Autora / marca | Sara / Spanish2Go (Sara García Fuster) | Sobre mí, pie de página, condiciones |

---

## Propuesta de valor (home)

Fuente: https://spanish2go.online/

- Posicionamiento: formación y comunidad para **profesores/as de español no nativos**.
- Mensaje: perfeccionar el español y las clases, con comunidad para reciclarse junto a otros profes.
- Comunidad: “primera comunidad para profes de español no nativos”; mención de **más de 50 nacionalidades**.
- Problema recurrente: “soledad del no nativo”, miedo a no ser “suficientemente bueno”, acento, no conocer todas las palabras / expresiones.
- Oferta en home: cursos a tu ritmo, podcast, recursos gratuitos, blog, contacto.

---

## Profesores no nativos

No hay una página única titulada exactamente “Profesores no nativos”; es el **eje de toda la marca**.

Fuentes: home, `/cursos/`, landings de cursos en `_research_out/spanish2go_migration/*.json`.

Contenido usable:

- Formación orientada a docentes ELE no nativos.
- Comunidad segura (“no existen las preguntas tontas”).
- Cursos asíncronos con énfasis comercial en profes no nativos (`curso_mis_4_amigos_del_pasado.json` → `targetAudience`).
- Taller práctico de calentamientos y cortos (`curso_taller_calentamientos.json`).

**PENDIENTE:** programa formal de “formación de profesores no nativos” como producto empaquetado distinto de cursos/talleres ya inventariados.

---

## Cursos online

Fuentes: uTeach + landings (ver JSON + `INVENTARIO_Y_COBERTURA.md`).

| Curso | Precio | Estado en Academia (seed) |
|---|---|---|
| Taller calentamientos top y cortos modernos | 40 EUR | DRAFT (no publicar automáticamente) |
| Mis 4 amigos del pasado | 150 EUR | DRAFT (no publicar automáticamente) |

Modalidad comercial documentada (Mis 4 amigos): 100% online, a tu ritmo, acceso con usuario/contraseña.

Home comercial también menciona cursos a tu ritmo y ediciones con matrícula cerrada / lista de espera (`/cursos/`).

---

## Píldoras educativas

**El término “píldoras educativas” no aparece** en las páginas públicas revisadas de `spanish2go.online`.

Lo más cercano documentado son **recursos gratuitos / ebooks cortos**:

| Recurso | URL pública | Notas |
|---|---|---|
| Recursos gratuitos (hub) | https://spanish2go.online/recursos-gratuitos/ | Cuaderno síndrome del impostor + 6 modismos de regalo |
| Enseña a debatir como un nativo | https://spanish2go.online/ensena-a-tus-alumnos-a-debatir-como-un-nativo/ | Ebook: frases de opinión/acuerdo, coletillas, 12 fotos debate exprés |
| Ebook hablar por los codos | https://spanish2go.online/ebook-para-hablar-por-los-codos/ | 50 modismos, 5 historias, poema/acróstico |
| Di adiós al síndrome del impostor | https://spanish2go.online/di-adios-al-sindrome-del-impostor/ | Landing mínima; detalle de descarga no capturado |
| Podcast | https://spanish2go.online/podcast/ | “Español sin miedo”; entrevistas y consejos |

**PENDIENTE en Academia:**

- Archivos descargables (PDF/ebooks) no migrados.
- Modelo de contenidos tipo “píldora” dedicado (no existe en Prisma; no inventar CMS).
- Confirmación de producto de si “píldoras” = recursos gratuitos u otra línea.

---

## Mentorías individuales

Fuentes:

- Menciones en taller (“profes a las que mentorizo”).
- Blabla2Go: “Puede que ya hayas participado en alguna de mis mentorías”.
- `/cursos/`: clases a medida + sesión gratuita de 30 minutos (ver asesoría).
- Formato clases 1:1 en `/cursos/`: duración 1 hora, Zoom, participación 100%.
- `/mentoria/` y `/mentoria-para-profes/`: landings históricas de **webinario gratuito** (sep 2022), no un catálogo de packs de mentoría 1:1 con precio.

**Documentado:** existe acompañamiento/mentorías y clases individuales 1:1 por Zoom.  
**PENDIENTE:** precios, duración de packs, disponibilidad y flujo de reserva propio de Academia (Spanish2Go usaba Booking Calendar en `/reservas/`; Academia no tiene esa integración).

---

## Blabla2Go

Fuentes: https://spanish2go.online/blabla2go/ + posts públicos LinkedIn (ediciones).

**Qué es (verificado):** club / formación grupal periódica para profes de español **no nativos** — “hablar por los codos”.

Características documentadas en la landing:

- Reunión **1 vez al mes**, **2 horas**, sesiones guiadas con material.
- Grupo privado de **WhatsApp**.
- Ediciones de **3 meses**.
- Temas actuales, frescos, útiles; sin preparación previa exigida al participante.
- Grabación si no se puede asistir.
- Descuento **10%** en formaciones por pertenecer.
- Precio publicado en la landing capturada: **62 €** (3 meses, IVA incluido) — puede variar por edición.
- Plazas limitadas (posts LinkedIn mencionan máximo **6** personas).
- No es un curso asíncrono LMS, ni solo podcast, ni app.

**PENDIENTE:** inscripción/pago automatizado en Academia; no simular plazas ni disponibilidad.

---

## Asesoría gratuita

Fuente: https://spanish2go.online/cursos/

Texto documentado:

> ¿Quieres una sesión GRATUITA conmigo?  
> … te propongo **30 minutos** enfocados en ti. Donde veremos qué necesitas y cómo trazar una hoja de ruta juntas para mejorar tu práctica docente.  
> SESIÓN PRIVADA CON SARA

También existía Booking Calendar en https://spanish2go.online/reservas/ (plugin WordPress).

**PENDIENTE en Academia:** calendario de reservas, slots y confirmación automática.  
CTA seguro: mailto / contacto sin fingir reserva exitosa ni mostrar disponibilidad inventada.

---

## Capacidades Academia ya existentes (reutilizar)

| Necesidad | Capacidad actual |
|---|---|
| Catálogo cursos online publicados | `GET /public/online-courses` → `/cursos` |
| Detalle curso | `GET /public/online-courses/:slug` → `/cursos/[slug]` |
| LMS asíncrono | dashboard estudiante + backoffice online-courses |
| Materiales de clase (privado) | Material LINK/FILE — **no** catálogo público de píldoras |
| Clases 1:1 Zoom/Meet | dominio clases (operativo, no booking público) |

No duplicar el LMS. No publicar cursos DRAFT del seed Spanish2Go.
