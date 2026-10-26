/**
 * Public copy recovered from Spanish2Go sources documented in
 * `_research_out/spanish2go_migration/OFERTA_COMERCIAL_PUBLICA.md`.
 * Do not invent commercial claims beyond that inventory.
 */

export const spanish2goContact = {
  email: 'info@spanish2go.online',
  phoneDisplay: '+34 675 077 589',
  phoneTel: '+34675077589',
} as const

export function advisoryMailto(subject = 'Solicitud de asesoría gratuita'): string {
  const params = new URLSearchParams({
    subject,
    body: 'Hola Sara,\n\nQuisiera agendar la sesión gratuita de 30 minutos para trazar una hoja de ruta de mi práctica docente.\n\nNombre:\nDisponibilidad aproximada:\n\nGracias.',
  })
  return `mailto:${spanish2goContact.email}?${params.toString()}`
}

export const homeValueProp = {
  eyebrow: 'Formación para profes de español no nativos',
  title: 'Español para llevar, hasta donde estés.',
  lead:
    'Perfeccioná tu español y tus clases creando comunidad para reciclarte constantemente junto a otros profes, como vos.',
} as const

export const nonNativeTeachers = {
  title: 'Formación para profesores no nativos',
  lead:
    'Spanish2Go nace como espacio para profes de español cuyo idioma nativo no es el español: un lugar seguro donde no existen las preguntas tontas.',
  pillars: [
    {
      title: 'Comunidad',
      text: 'Comunidad para profes de español no nativos, con participantes de más de 50 nacionalidades según la propuesta pública original.',
    },
    {
      title: 'Formación útil',
      text: 'Cursos y talleres pensados para aplicar en clase de forma inmediata, con énfasis en utilidad y practicidad.',
    },
    {
      title: 'Acompañamiento',
      text: 'Mentorías, talleres y espacios como Blabla2Go para no enseñar en soledad.',
    },
  ],
  painPoints: [
    'La “soledad del no nativo” y la sensación de no ser “suficientemente bueno”.',
    'Miedo al acento o a no conocer todas las palabras y expresiones actuales.',
    'Falta de un grupo donde poder ser profe y alumno al mismo tiempo.',
  ],
  pending: [
    'Programa empaquetado de “formación de profesores no nativos” distinto de los cursos ya inventariados.',
  ],
} as const

export const onlineCoursesOffer = {
  title: 'Cursos online a tu ritmo',
  lead:
    'Formaciones asíncronas para docentes ELE. El catálogo público de Academia muestra únicamente cursos publicados.',
  documentedCourses: [
    {
      title: 'Taller calentamientos top y cortos modernos',
      summary:
        'Taller práctico de calentamientos (actividades, juegos o herramientas sencillas) y selección de cortos modernos. Precio documentado: 40 EUR.',
    },
    {
      title: 'Mis 4 amigos del pasado: Un viaje pedagógico',
      summary:
        'Curso sobre los 4 pasados del español con storytelling y gramática cognitiva. Precio documentado: 150 EUR. 100% online, a tu ritmo.',
    },
  ],
  note: 'Los cursos importados desde Spanish2Go permanecen en borrador hasta publicación manual. No se publican automáticamente.',
} as const

export const educationalPills = {
  title: 'Píldoras educativas',
  namingNote:
    'En el sitio original de Spanish2Go no aparece el nombre “píldoras educativas”. Lo documentado son recursos gratuitos y ebooks cortos. En Academia usamos esta sección para presentarlos.',
  items: [
    {
      title: 'Cuaderno del síndrome del impostor',
      text: 'Trucos para superar el síndrome del impostor, con 6 modismos de regalo (recursos gratuitos).',
      source: 'https://spanish2go.online/recursos-gratuitos/',
    },
    {
      title: 'Enseña a debatir como un nativo',
      text: 'Ebook con frases para opinar, acuerdo/desacuerdo, coletillas, trucos de debate y 12 fotos para debates exprés.',
      source: 'https://spanish2go.online/ensena-a-tus-alumnos-a-debatir-como-un-nativo/',
    },
    {
      title: 'Ebook para hablar por los codos',
      text: '50 modismos organizados, 5 historias en contexto, 1 poema y 1 acróstico para llevar a clase.',
      source: 'https://spanish2go.online/ebook-para-hablar-por-los-codos/',
    },
  ],
  pending: [
    'Archivos PDF/ebooks no migrados a Academia (sin descargas inventadas).',
    'Modelo de contenidos “píldora” dedicado: Academia no tiene un CMS público aparte del LMS de cursos online.',
  ],
} as const

export const mentorship = {
  title: 'Mentorías individuales',
  lead:
    'Acompañamiento 1:1 para mejorar tu español y tu práctica docente, más allá de los cursos a tu ritmo.',
  points: [
    'Las landings originales mencionan mentorías como parte del recorrido con Sara.',
    'En la oferta de cursos se presentan clases a medida: duración 1 hora, plataforma Zoom, participación 100%.',
    'Si lo tuyo no son las grupales ni los cursos a tu ritmo, también podés mejorar tu español directamente con sesiones privadas.',
  ],
  freeSession:
    'Hay una sesión gratuita documentada de 30 minutos para ver qué necesitás y trazar una hoja de ruta de tu práctica docente.',
  pending: [
    'Precios y packs de mentoría 1:1 no están publicados de forma completa en las fuentes capturadas.',
    'Reserva automática: Spanish2Go usaba Booking Calendar; Academia aún no expone disponibilidad ni confirma reservas públicas.',
  ],
} as const

export const blabla2go = {
  title: 'Blabla2Go',
  lead:
    'Club de encuentros para profes de español no nativos: un espacio para hablar por los codos, reciclar el español y llevar temas actuales a clase.',
  whatItIs: [
    'Reunión 1 vez al mes durante 2 horas, con sesiones guiadas y material incluido.',
    'Comunidad privada en un grupo de WhatsApp.',
    'Cada edición dura 3 meses; sin compromiso anual obligatorio según la landing.',
    'Si no podés asistir al directo, la grabación queda disponible.',
    'Descuento del 10% en formaciones por pertenecer (según landing).',
  ],
  notAssumed: [
    'No es un curso asíncrono del LMS.',
    'No es únicamente un podcast.',
    'No es una aplicación móvil.',
  ],
  commercialNote:
    'La landing pública listó 62 € por 3 meses (IVA incluido) y plazas limitadas; el precio y la edición vigente pueden cambiar. No mostramos disponibilidad inventada.',
  pending: [
    'Inscripción y cobro automatizados en Academia.',
    'Calendario de la edición vigente sin depender del sitio WordPress externo.',
  ],
} as const

export const freeAdvisory = {
  title: 'Asesoría gratuita de 30 minutos',
  lead:
    'Una sesión privada enfocada en vos: qué necesitás y cómo trazar una hoja de ruta para mejorar tu práctica docente.',
  bullets: [
    'Duración documentada: 30 minutos.',
    'Enfocada en diagnóstico y hoja de ruta, no en una clase completa.',
    'Pensada para profes que quieren orientación antes de elegir formación o mentoría.',
  ],
  pending: [
    'Calendario de reservas y confirmación automática (no integrado en Academia).',
    'No se simulan turnos ni mensajes de “reserva confirmada”.',
  ],
} as const
