import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Regression: a missing or unquoted translation key only fails at run time (it blanked the team panel once).
// Every t('...') key used by the new screens must exist in all six language dictionaries.
const here = dirname(fileURLToPath(import.meta.url))
const dict = readFileSync(join(here, 'index.jsx'), 'utf8')
const screens = ['../FamilyPanel.jsx', '../TeamWellbeing.jsx', '../WellbeingPanel.jsx', '../ChatPanel.jsx', '../TeamPanel.jsx']

describe('translation keys used by the new screens', () => {
  for (const file of screens) {
    it(`${file} only uses quoted keys that exist in six languages`, () => {
      const src = readFileSync(join(here, file), 'utf8')
      // Unquoted key names are a bug: t(wbLogTitle) instead of t('wbLogTitle'). Variables such as t(label) are
      // legitimate; only identifiers that look like keys of these modules are flagged.
      const bare = [...src.matchAll(/\bt\((?!['"`])((?:wb|fam|team|chat)[A-Z]\w*)\)/g)].map((m) => m[1])
      expect(bare).toEqual([])
      const keys = [...new Set([...src.matchAll(/\bt\('([^']+)'\)/g)].map((m) => m[1]))]
      for (const key of keys) {
        const count = (dict.match(new RegExp(`^ {4}${key}:`, 'gm')) || []).length
        // Inline dictionaries (en/fr keys written on one line) also count.
        const inline = (dict.match(new RegExp(`[ ,{]${key}:`, 'g')) || []).length
        expect(count + inline, `key ${key}`).toBeGreaterThanOrEqual(6)
      }
    })
  }
})
