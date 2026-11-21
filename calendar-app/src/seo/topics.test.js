import { describe, it, expect } from 'vitest'
import { TOPIC_LANGS, TOPIC_SLUGS, TOPICS } from './topics.js'
import { renderTopic, sitemap, topicUrl } from './pages.js'

describe('audience and feature pages', () => {
  for (const lang of TOPIC_LANGS) {
    for (const slug of TOPIC_SLUGS) {
      it(`${lang}/${slug}: complete page`, () => {
        const html = renderTopic(lang, slug)
        expect(html).toContain(`<html lang="${lang}"`)
        expect(html).toContain(`<link rel="canonical" href="${topicUrl(lang, slug)}" />`)
        expect(html).toContain(TOPICS[slug][lang].title)
        expect(html).toContain('og:title')
        expect(html).toContain('twitter:card')
        for (const l of TOPIC_LANGS) expect(html).toContain(`hreflang="${l}" href="${topicUrl(l, slug)}"`)
        expect(html).toContain(topicUrl(lang, TOPICS[slug][lang].related[0]))
        expect(html).toContain(`/${lang}/pricing`)
      })
    }
  }

  it('sitemap lists the 21 topic URLs', () => {
    const xml = sitemap('2026-11-21')
    for (const lang of TOPIC_LANGS) for (const slug of TOPIC_SLUGS) expect(xml).toContain(`<loc>${topicUrl(lang, slug)}</loc>`)
    expect(xml.match(/<loc>/g)).toHaveLength(40)
  })

  it('states limits on the two reduced topics', () => {
    expect(renderTopic('en', 'sports-clubs')).toContain('What Collyo does not provide')
    expect(renderTopic('fr', 'sports-clubs')).toContain('Pas de feuille de présence')
    expect(renderTopic('pt', 'school-classes')).toContain('Sem notas')
  })
})
