import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveSpanish2GoResearchDir } from './spanish2go-online-courses.js';

type JsonCourseFile = {
  course: { title: string; slug: string };
  modules: Array<{
    title: string;
    position: number;
    lessons: Array<{ title: string; position: number; assets?: unknown[] }>;
  }>;
  coverage?: {
    modulesIdentified?: number;
    lessonsIdentified?: number;
  };
};

function load(filename: string): JsonCourseFile {
  const full = path.join(resolveSpanish2GoResearchDir(), filename);
  return JSON.parse(readFileSync(full, 'utf8')) as JsonCourseFile;
}

describe('Spanish2Go research JSON', () => {
  it('resolves research files next to the monorepo root', () => {
    const dir = resolveSpanish2GoResearchDir();
    expect(dir).toContain('_research_out/spanish2go_migration');
    // Sanity: path is absolute and reachable from this test file location.
    expect(path.isAbsolute(dir)).toBe(true);
    expect(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../../_research_out/spanish2go_migration',
      ),
    ).toBe(dir);
  });

  it('taller has 5 modules and 5 lessons in stable order', () => {
    const data = load('curso_taller_calentamientos.json');
    expect(data.course.slug).toBe(
      'taller-calentamientos-top-y-cortos-modernos',
    );
    expect(data.modules).toHaveLength(5);
    const lessons = data.modules.flatMap((m) => m.lessons);
    expect(lessons).toHaveLength(5);
    expect(data.coverage?.modulesIdentified).toBe(5);
    expect(data.coverage?.lessonsIdentified).toBe(5);

    const positions = data.modules.map((m) => m.position);
    expect(positions).toEqual([1, 2, 3, 4, 5]);
    expect(data.modules.map((m) => m.title)).toEqual([
      'Grabación',
      'PRESENTACIÓN',
      'Valoración del taller',
      'Descuento 10% curso Mis 4 amigos del pasado',
      'GRACIAS',
    ]);
    expect(lessons.map((l) => l.title)).toEqual([
      'Grabación del taller',
      'Descárgatela',
      'Valora el taller',
      'CURSO MIS 4 AMIGOS DEL PASADO',
      'GRACIAS',
    ]);
  });

  it('mis 4 amigos has 11 modules and 40 lessons', () => {
    const data = load('curso_mis_4_amigos_del_pasado.json');
    expect(data.course.slug).toBe('mis-4-amigos-pasados-del-pasado');
    expect(data.modules).toHaveLength(11);
    const lessons = data.modules.flatMap((m) => m.lessons);
    expect(lessons).toHaveLength(40);
    expect(data.coverage?.modulesIdentified).toBe(11);
    expect(data.coverage?.lessonsIdentified).toBe(40);

    const lessonCounts = data.modules.map((m) => m.lessons.length);
    expect(lessonCounts).toEqual([1, 2, 7, 7, 6, 4, 2, 2, 1, 1, 7]);
  });

  it('never includes accessible asset source URLs', () => {
    for (const filename of [
      'curso_taller_calentamientos.json',
      'curso_mis_4_amigos_del_pasado.json',
    ] as const) {
      const data = load(filename);
      for (const mod of data.modules) {
        for (const lesson of mod.lessons) {
          for (const asset of lesson.assets ?? []) {
            const row = asset as { sourceUrl?: string | null };
            expect(row.sourceUrl ?? null).toBeNull();
          }
        }
      }
    }
  });
});
