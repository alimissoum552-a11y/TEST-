// Static, indexable landing pages, one per language (/en/, /fr/, /es/, /de/, /ar/, /pt/).
// The app itself renders in the browser, so search engines see an almost empty page at "/".
// These pages carry the same text as the landing page in plain HTML, with hreflang links,
// structured data, a sitemap and robots.txt. Pure functions: scripts/seo-pages.mjs writes the files.
import { LANDING } from '../landing.js'

export const SITE = 'https://collyo.app'
export const SEO_LANGS = ['en', 'fr', 'es', 'de', 'ar', 'pt']
const RTL = new Set(['ar'])

// The app reads its language from this key (src/i18n/index.jsx): /seo-lang.js sets it so that
// "Create an account" on /fr/ opens the app in French.
export const LANG_STORAGE_KEY = 'calendar-app.lang'

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export const pageUrl = (lang) => `${SITE}/${lang}/`

// <link rel="alternate" hreflang> for every language, plus x-default on the app root.
export function alternates() {
  return [
    ...SEO_LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${pageUrl(l)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
  ].join('\n    ')
}

// JSON-LD: the app and its FAQ. Only facts the landing page already states (a free plan exists).
export function structuredData(lang) {
  const L = LANDING[lang]
  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Collyo',
    url: pageUrl(lang),
    inLanguage: lang,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: L.seoDesc,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  }
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: L.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  // Escape "<" so no text can close the script element.
  return [app, faq].map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n    ')
}

const CSS = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#171717;background:#f5f5f5;line-height:1.55}
main,header,footer{max-width:960px;margin:0 auto;padding:0 24px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:24px}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:20px;color:#171717;text-decoration:none}.brand img{width:36px;height:36px}
nav.langs{display:flex;flex-wrap:wrap;gap:10px;font-size:13px}nav.langs a{color:#525252}nav.langs a[aria-current]{color:#171717;font-weight:600}
.eyebrow{margin:56px 0 8px;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#525252}
h1{font-size:clamp(32px,6vw,52px);line-height:1.1;margin:0 0 16px}h2{font-size:26px;margin:56px 0 16px}h3{font-size:18px;margin:0 0 6px}
.sub{font-size:19px;color:#404040;max-width:680px}.cta{display:flex;flex-wrap:wrap;gap:16px;align-items:center;margin:28px 0}
.btn{display:inline-block;padding:12px 22px;border-radius:16px;background:#171717;color:#fff;text-decoration:none;font-weight:500}.link{color:#171717}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.card{background:#fff;border:1px solid #e5e5e5;border-radius:20px;padding:20px}
.card p,li{color:#404040}ol,ul{padding-inline-start:22px}details{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:14px 18px;margin-bottom:10px}
p.tag{margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#737373}
summary{font-weight:600;cursor:pointer}footer{padding:48px 24px;font-size:13px;color:#737373;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between}footer a{color:#525252}`

// One language page, self-contained: inline styles (allowed by the CSP), images from public/.
export function renderPage(lang) {
  const L = LANDING[lang]
  if (!L) throw new Error(`No landing copy for ${lang}`)
  const dir = RTL.has(lang) ? 'rtl' : 'ltr'
  const features = [L.calendar, L.team, L.ai, L.reminders, L.share, L.wellbeing, L.connector]
  const langNav = SEO_LANGS.map((l) => `<a href="/${l}/" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="page"' : ''}>${l.toUpperCase()}</a>`).join('')
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(L.seoTitle)}</title>
    <meta name="description" content="${esc(L.seoDesc)}" />
    <link rel="canonical" href="${pageUrl(lang)}" />
    ${alternates()}
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="#f5f5f5" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Collyo" />
    <meta property="og:url" content="${pageUrl(lang)}" />
    <meta property="og:title" content="${esc(L.seoTitle)}" />
    <meta property="og:description" content="${esc(L.seoDesc)}" />
    <meta property="og:image" content="${SITE}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    ${structuredData(lang)}
    <style>${CSS}</style>
    <script src="/seo-lang.js" data-lang="${lang}" defer></script>
  </head>
  <body>
    <header>
      <a class="brand" href="/${lang}/"><img src="/logo-192.png" alt="" width="36" height="36" />Collyo</a>
      <nav class="langs" aria-label="Language">${langNav}</nav>
    </header>
    <main>
      <p class="eyebrow">${esc(L.eyebrow)}</p>
      <h1>${esc(L.title)}</h1>
      <p class="sub">${esc(L.sub)}</p>
      <p class="cta"><a class="btn" href="/#/signup">${esc(L.signup)}</a> <a class="link" href="/#/signin">${esc(L.signin)}</a> <a class="link" href="/#/pricing">${esc(L.pricing)}</a></p>

      <h2>${esc(L.howTitle)}</h2>
      <ol>${L.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>

      <h2>${esc(L.audTitle)}</h2>
      <div class="grid">${L.aud.map(([title, points], i) => `
        <section class="card"><p class="tag">${esc(L.audTabs[i])}</p><h3>${esc(title)}</h3><ul>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></section>`).join('')}
      </div>

      <h2>${esc(L.groups[0])}</h2>
      <p>${esc(L.groups[1])}</p>

      <h2>${esc(L.cardsTitle)}</h2>
      <div class="grid">${features.map(([title, text]) => `
        <section class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p></section>`).join('')}
      </div>

      <h2>${esc(L.trustTitle)}</h2>
      <div class="grid">${L.trust.map(([title, text]) => `
        <section class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p></section>`).join('')}
      </div>

      <h2>${esc(L.faqTitle)}</h2>
      ${L.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ')}

      <p class="cta"><a class="btn" href="/#/signup">${esc(L.signup)}</a></p>
    </main>
    <footer>
      <a href="/#/pricing">${esc(L.pricing)}</a>
    </footer>
  </body>
</html>
`
}

export function sitemap(lastmod) {
  const urls = [`${SITE}/`, ...SEO_LANGS.map(pageUrl)]
  const links = SEO_LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l)}"/>`).join('') +
    `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod>${links}</url>`).join('\n')}
</urlset>
`
}

export function robots() {
  return `User-agent: *
Allow: /
Disallow: /mcp

Sitemap: ${SITE}/sitemap.xml
`
}

// Served as /seo-lang.js: a visitor who chose a language page keeps that language in the app.
export function langScript() {
  return `(function(){try{var s=document.currentScript;var l=s&&s.getAttribute('data-lang');if(l)localStorage.setItem(${JSON.stringify(LANG_STORAGE_KEY)},l)}catch(e){}})();
`
}
