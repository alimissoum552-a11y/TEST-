// Header shown at the top of every e-mail Collyo sends: the "C" mark and the name.
// The image is served from the web app (public/logo-192.png), so it must be deployed with the app.
export function brandHeader(appUrl: string = Deno.env.get('APP_URL') ?? 'https://collyo.app'): string {
  const base = appUrl.replace(/\/+$/, '')
  return `<p style="margin:0 0 18px"><img src="${base}/logo-192.png" width="32" height="32" alt="" style="vertical-align:middle;border:0"> <span style="vertical-align:middle;font-size:18px;font-weight:600;letter-spacing:-0.2px">Collyo</span></p>`
}
