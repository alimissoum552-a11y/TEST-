import { describe, it, expect } from 'vitest'
import {
  nameMatches, normalizeName, validBirthYear, ageFromBirthYear, needsResponsibleAdult,
  functionsNeedingDeclaration, isGroupKind, CONSENT_AGE, consentRequired, SEX_VALUES,
} from './family.js'

const NOW = new Date('2026-11-17T12:00:00Z')

describe('names', () => {
  it('normalises spaces and case', () => {
    expect(normalizeName('  Marie   DUPONT ')).toBe('marie dupont')
  })
  it('matches first and last name in any case, with extra spaces', () => {
    expect(nameMatches('marie', 'Dupont', 'Marie  Dupont')).toBe(true)
  })
  it('ignores the order of first and last name (Stripe can return them swapped)', () => {
    expect(nameMatches('Said', 'ZEGHIDI', 'ZEGHIDI Said')).toBe(true)
  })
  it('ignores accents', () => {
    expect(nameMatches('José', 'Núñez', 'jose nunez')).toBe(true)
  })
  it('rejects a different name and an empty name', () => {
    expect(nameMatches('Marie', 'Martin', 'Marie Dupont')).toBe(false)
    expect(nameMatches('', '', '')).toBe(false)
  })
})

describe('birth year and age', () => {
  it('accepts a plausible year and rejects future or very old years', () => {
    expect(validBirthYear(2012, NOW)).toBe(true)
    expect(validBirthYear(2027, NOW)).toBe(false)
    expect(validBirthYear(1950, NOW)).toBe(false)
    expect(validBirthYear('abc', NOW)).toBe(false)
  })
  it('computes the age from the year only', () => {
    expect(ageFromBirthYear(2012, NOW)).toBe(14)
  })
  it('requires a responsible adult under the age of consent', () => {
    expect(CONSENT_AGE).toBe(16)
    expect(needsResponsibleAdult(2012, NOW)).toBe(true)
    expect(needsResponsibleAdult(2005, NOW)).toBe(false)
  })
})

describe('sensitive functions and kinds', () => {
  it('asks for a declaration when sex is given', () => {
    expect(functionsNeedingDeclaration({ sex: 'female' })).toEqual(['sex'])
    expect(functionsNeedingDeclaration({ sex: null })).toEqual([])
  })
  it('recognises the group kinds only', () => {
    expect(isGroupKind('family')).toBe(true)
    expect(isGroupKind('sports')).toBe(true)
    expect(isGroupKind('class')).toBe(true)
    expect(isGroupKind('work')).toBe(false)
    expect(isGroupKind('personal')).toBe(false)
  })
})

describe("sex values", () => {
  it("are female and male only, and the field stays optional", () => {
    expect(SEX_VALUES).toEqual(['female', 'male'])
    expect(functionsNeedingDeclaration({ sex: null })).toEqual([])
  })
})

describe("guardian consent", () => {
  it("is needed when the child may be under 13 and not otherwise", () => {
    expect(consentRequired(2026 - 9, NOW)).toBe(true)
    expect(consentRequired(2026 - 13, NOW)).toBe(true) // 12 or 13: unknown, so consent
    expect(consentRequired(2026 - 14, NOW)).toBe(false)
    expect(consentRequired(2005, NOW)).toBe(false)
  })
})
