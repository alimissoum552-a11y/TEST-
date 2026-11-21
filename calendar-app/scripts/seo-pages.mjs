// After `vite build`: writes the static language pages, sitemap.xml, robots.txt and seo-lang.js into dist/.
// See src/seo/pages.js. Run by `npm run build`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEO_LANGS, renderPage, renderPricing, renderSignup, renderTopic, sitemap, robots, langScript } from '../src/seo/pages.js'
import { TOPIC_LANGS, TOPIC_SLUGS } from '../src/seo/topics.js'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const write = (rel, text) => { const f = join(dist, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text) }

for (const lang of SEO_LANGS) {
  write(`${lang}/index.html`, renderPage(lang))
  write(`${lang}/pricing/index.html`, renderPricing(lang))
  write(`${lang}/signup/index.html`, renderSignup(lang))
}
for (const lang of TOPIC_LANGS) for (const slug of TOPIC_SLUGS) write(`${lang}/${slug}/index.html`, renderTopic(lang, slug))
write('sitemap.xml', sitemap(new Date().toISOString().slice(0, 10)))
write('robots.txt', robots())
write('seo-lang.js', langScript())
console.log(`SEO: ${SEO_LANGS.length} language pages + ${SEO_LANGS.length * 2} route pages, ${TOPIC_LANGS.length * TOPIC_SLUGS.length} topic pages, sitemap.xml, robots.txt, seo-lang.js`)
