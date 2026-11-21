// Static, indexable landing pages, one per language (/en/, /fr/, /es/, /de/, /ar/, /pt/).
// The app itself renders in the browser, so search engines see an almost empty page at "/".
// These pages carry the same text as the landing page in plain HTML, with hreflang links,
// structured data, a sitemap and robots.txt. Pure functions: scripts/seo-pages.mjs writes the files.
import { LANDING } from '../landing.js'
import { PRICING } from '../pricing.js'
import { TOPICS, TOPIC_LANGS, TOPIC_SLUGS } from './topics.js'

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
      <a href="/${lang}/pricing">${esc(L.pricing)}</a>
      <a href="/${lang}/signup">${esc(L.signup)}</a>
      ${TOPIC_LANGS.includes(lang) ? TOPIC_SLUGS.map((s) => `<a href="${topicUrl(lang, s)}">${esc(TOPIC_NAV[s][lang])}</a>`).join('\n      ') : ''}
    </footer>
  </body>
</html>
`
}

export function sitemap(lastmod) {
  const routeEntry = (fn) => SEO_LANGS.map((l) => {
    const links = SEO_LANGS.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${fn(x)}"/>`).join('') +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${fn('en')}"/>`
    return `  <url><loc>${fn(l)}</loc><lastmod>${lastmod}</lastmod>${links}</url>`
  }).join('\n')
  const urls = [`${SITE}/`, ...SEO_LANGS.map(pageUrl)]
  const links = SEO_LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l)}"/>`).join('') +
    `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod>${links}</url>`).join('\n')}
${routeEntry(pricingUrl)}
${routeEntry(signupUrl)}
${TOPIC_SLUGS.map((slug) => TOPIC_LANGS.map((l) => {
  const links = TOPIC_LANGS.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${topicUrl(x, slug)}"/>`).join('') +
    `<xhtml:link rel="alternate" hreflang="x-default" href="${topicUrl('en', slug)}"/>`
  return `  <url><loc>${topicUrl(l, slug)}</loc><lastmod>${lastmod}</lastmod>${links}</url>`
}).join('\n')).join('\n')}
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

// ---- Pricing and Signup routes ----
export const pricingUrl = (lang) => `${SITE}/${lang}/pricing`
export const signupUrl = (lang) => `${SITE}/${lang}/signup`

// hreflang for one route, across all languages. x-default points to the English route.
function alternatesFor(pathFn) {
  return [
    ...SEO_LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${pathFn(l)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${pathFn('en')}" />`,
  ].join('\n    ')
}

function routeShell({ lang, title, description, canonical, alt, jsonld, body }) {
  const dir = RTL.has(lang) ? 'rtl' : 'ltr'
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${canonical}" />
    ${alt}
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="#f5f5f5" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Collyo" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    ${jsonld || ''}
    <style>${CSS}</style>
  </head>
  <body>
    <header>
      <a class="brand" href="/${lang}/"><img src="/logo-192.png" alt="" width="36" height="36" />Collyo</a>
      <nav class="langs" aria-label="Language">${SEO_LANGS.map((l) => `<a href="/${l}/" hreflang="${l}" lang="${l}">${l.toUpperCase()}</a>`).join('')}</nav>
    </header>
    <main>${body}</main>
    <footer>
      <a href="/${lang}/">${esc(LANDING[lang].title)}</a>
      <a href="${pricingUrl(lang)}">${esc(PRICING[lang].title)}</a>
      <a href="${signupUrl(lang)}">${esc(LANDING[lang].signup)}</a>
    </footer>
  </body>
</html>
`
}

// The free plan is the only price stated in the repository; no paid price is claimed here.
function pricingJsonLd(lang) {
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Collyo',
    url: pricingUrl(lang), inLanguage: lang, applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web', description: PRICING[lang].banner,
  }).replace(/</g, '\\u003c')}</script>`
}

export function renderPricing(lang) {
  const P = PRICING[lang]
  if (!P) throw new Error(`No pricing copy for ${lang}`)
  const plans = Object.entries(P.plans).map(([, plan]) => `
        <section class="card"><p class="tag">${esc(plan.tag)}</p><h3>${esc(plan.name)}</h3>
          <ul>${plan.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('')
  const body = `
      <p class="eyebrow">${esc(P.title)}</p>
      <h1>${esc(P.title)}</h1>
      <p class="sub">${esc(P.banner)}</p>
      <div class="grid">${plans}
      </div>
      <p class="cta"><a class="btn" href="${signupUrl(lang)}">${esc(LANDING[lang].signup)}</a>
        <a class="link" href="/${lang}/">${esc(LANDING[lang].title)}</a></p>`
  return routeShell({
    lang, title: `${P.title} · Collyo`, description: P.banner, canonical: pricingUrl(lang),
    alt: alternatesFor(pricingUrl), jsonld: pricingJsonLd(lang), body,
  })
}

export function renderSignup(lang) {
  const L = LANDING[lang]
  if (!L) throw new Error(`No landing copy for ${lang}`)
  const body = `
      <p class="eyebrow">${esc(L.signup)}</p>
      <h1>${esc(L.signup)}</h1>
      <p class="sub">${esc(L.sub)}</p>
      <h2>${esc(L.howTitle)}</h2>
      <ol>${L.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="cta"><a class="btn" href="/#/signup">${esc(L.signup)}</a>
        <a class="link" href="/#/signin">${esc(L.signin)}</a>
        <a class="link" href="${pricingUrl(lang)}">${esc(L.pricing)}</a></p>`
  return routeShell({
    lang, title: `${L.signup} · Collyo`, description: L.sub, canonical: signupUrl(lang),
    alt: alternatesFor(signupUrl), jsonld: '', body,
  })
}

// ---- Audience and feature pages (EN/FR/PT) ----
export const topicUrl = (lang, slug) => `${SITE}/${lang}/${slug}`

const NOT_PROVIDED = {
  en: 'What Collyo does not provide',
  fr: 'Ce que Collyo ne fait pas',
  pt: 'O que o Collyo não faz',
}
const TOPIC_NAV = {
  families: { en: 'Families', fr: 'Familles', pt: 'Famílias' },
  'sports-clubs': { en: 'Sports clubs', fr: 'Clubs sportifs', pt: 'Clubes' },
  'school-classes': { en: 'School classes', fr: 'Classes', pt: 'Turmas' },
  'work-teams': { en: 'Work teams', fr: 'Équipes', pt: 'Equipas' },
  'ai-assistant': { en: 'AI assistant', fr: 'Assistant IA', pt: 'Assistente de IA' },
  'signed-declarations': { en: 'Signed declarations', fr: 'Déclarations signées', pt: 'Declarações' },
  'mcp-connector': { en: 'MCP connector', fr: 'Connecteur MCP', pt: 'Conector MCP' },
}

function topicAlternates(slug) {
  return [
    ...TOPIC_LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${topicUrl(l, slug)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${topicUrl('en', slug)}" />`,
  ].join('\n    ')
}

function topicJsonLd(lang, slug) {
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebPage', name: TOPICS[slug][lang].title,
    description: TOPICS[slug][lang].desc, url: topicUrl(lang, slug), inLanguage: lang,
  }).replace(/</g, '\\u003c')}</script>`
}

export function renderTopic(lang, slug) {
  const topic = TOPICS[slug]?.[lang]
  if (!topic) throw new Error(`No ${slug} copy for ${lang}`)
  const L = LANDING[lang]
  const related = topic.related
    .filter((r) => TOPICS[r])
    .map((r) => `<li><a href="${topicUrl(lang, r)}">${esc(TOPICS[r][lang].title)}</a></li>`).join('')
  const body = `
      <p class="eyebrow">${esc(topic.title)}</p>
      <h1>${esc(topic.title)}</h1>
      <p class="sub">${esc(topic.lead)}</p>
      ${topic.sections.map(([h, p]) => `<h2>${esc(h)}</h2>
      <p>${esc(p)}</p>`).join('')}
      <h2>${esc(NOT_PROVIDED[lang])}</h2>
      <ul>${topic.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="cta"><a class="btn" href="/#/signup">${esc(L.signup)}</a>
        <a class="link" href="${pricingUrl(lang)}">${esc(PRICING[lang].title)}</a></p>
      <h2>${esc(L.cardsTitle)}</h2>
      <ul>${related}</ul>`
  return routeShell({
    lang, title: topic.title, description: topic.desc, canonical: topicUrl(lang, slug),
    alt: topicAlternates(slug), jsonld: topicJsonLd(lang, slug), body,
  })
}
