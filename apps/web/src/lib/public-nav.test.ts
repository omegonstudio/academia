import { describe, expect, it } from 'vitest'
import { publicCta, publicNavLinks } from './public-nav'
import { publicRoutes } from './site'

describe('publicNavLinks', () => {
  it('covers the Spanish2Go offer destinations', () => {
    expect(publicNavLinks.map((link) => link.href)).toEqual([
      '/profesores-no-nativos',
      '/cursos',
      '/pildoras-educativas',
      '/mentorias',
      '/blabla2go',
    ])
    expect(publicCta.href).toBe('/asesoria')
  })

  it('keeps every nav path in the sitemap publicRoutes list', () => {
    const paths = new Set(publicRoutes.map((route) => route.path))
    for (const link of publicNavLinks) {
      expect(paths.has(link.href)).toBe(true)
    }
    expect(paths.has(publicCta.href)).toBe(true)
  })
})
