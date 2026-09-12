import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Escribinos para consultar por clases individuales, clases grupales o la formación de profesores de español.',
  alternates: { canonical: '/contact' },
};

const CONTACT_EMAIL = 'omegon.info@gmail.com';

export default function ContactPage() {
  return (
    <>
      <PageHeader
        title="Contacto"
        intro="Contanos qué estás buscando y te respondemos con las opciones disponibles."
      />

      {/*
        A mailto link rather than a form: the MVP has no contact-message
        persistence, and a form that silently discarded a message would be a
        fake feature.
      */}
      <p className="text-ink">
        Escribinos a{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-brand underline hover:text-brand-strong"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </>
  );
}
