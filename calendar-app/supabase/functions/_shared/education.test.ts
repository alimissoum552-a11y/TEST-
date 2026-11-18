import { describe, it, expect } from 'vitest'
import { domainOf, isFreeMail, isSchoolDomain } from './education.ts'

describe('education addresses', () => {
  it('reads the domain', () => { expect(domainOf(' Prof@Ac-Paris.FR ')).toBe('ac-paris.fr') })
  it('refuses personal mailboxes', () => {
    for (const a of ['x@gmail.com', 'x@outlook.com', 'x@orange.fr', 'x@icloud.com', 'x@sapo.pt']) expect(isFreeMail(a), a).toBe(true)
    expect(isFreeMail('x@ac-lyon.fr')).toBe(false)
  })
  it('recognises school and university domains', () => {
    for (const a of ['t@ac-paris.fr', 't@univ.edu', 't@escola.edu.pt', 't@ox.ac.uk', 't@school.sch.uk', 't@district.k12.ca.us', 't@educa.madrid.org', 't@min-edu.pt'])
      expect(isSchoolDomain(a), a).toBe(true)
  })
  it('sends other domains to a manual check', () => {
    for (const a of ['t@lycee-hugo.fr', 't@college.com', 't@example.org', 't@notedu.com', 't@']) expect(isSchoolDomain(a), a).toBe(false)
  })
})
