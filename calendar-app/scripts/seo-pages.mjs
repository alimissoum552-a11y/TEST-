// After `vite build`: writes the static language pages, sitemap.xml, robots.txt and seo-lang.js into dist/.
// See src/seo/pages.js. Run by `npm run build`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEO_LANGS, renderPage, sitemap, robots, langScript } from '../src/seo/pages.js'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const write = (rel, text) => { const f = join(dist, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text) }

for (const lang of SEO_LANGS) write(`${lang}/index.html`, renderPage(lang))
write('sitemap.xml', sitemap(new Date().toISOString().slice(0, 10)))
write('robots.txt', robots())
write('seo-lang.js', langScript())
console.log(`SEO: ${SEO_LANGS.length} language pages, sitemap.xml, robots.txt, seo-lang.js`)
