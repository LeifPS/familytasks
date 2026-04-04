/**
 * FamilyTasks – Cloudflare Worker
 *
 * Routing:
 *   /              → index.html  (die App)
 *   /admin-panel/  → changelog-admin.html  (passwortgeschützt via Cookie)
 *
 * Der Admin-Code wird NUR im Admin-Panel selbst (im JS) geprüft.
 * Dieser Worker schützt zusätzlich den Zugang zur Seite selbst
 * über einen URL-Parameter beim ersten Aufruf:
 *
 *   https://familytasks.leifps.workers.dev/admin-panel/?key=DEIN_KEY
 *
 * Passe ADMIN_KEY unten an!
 */

const ADMIN_KEY = 'meinGeheimesPasswort123'; // ← hier deinen Key eintragen

export default {
    async fetch(request, env) {
        const url  = new URL(request.url);
        const path = url.pathname;

        // ── /admin-panel/ ──────────────────────────────────────────────
        if (path === '/admin-panel' || path.startsWith('/admin-panel/')) {

            // 1. Prüfe ob der key als URL-Parameter mitgegeben wurde → setze Cookie
            const keyParam = url.searchParams.get('key');
            if (keyParam === ADMIN_KEY) {
                const html = await env.ASSETS.fetch(new Request(new URL('/changelog-admin.html', request.url)));
                const resp = new Response(html.body, html);
                resp.headers.set('Set-Cookie',
                    `ft_admin_key=${ADMIN_KEY}; Path=/admin-panel/; HttpOnly; SameSite=Strict; Max-Age=28800`
                );
                return resp;
            }

            // 2. Prüfe ob Cookie gesetzt ist
            const cookie = request.headers.get('Cookie') || '';
            const match  = cookie.match(/ft_admin_key=([^;]+)/);
            if (match && match[1] === ADMIN_KEY) {
                return env.ASSETS.fetch(new Request(new URL('/changelog-admin.html', request.url)));
            }

            // 3. Kein Key, kein Cookie → Zugang verweigert
            return new Response(deniedPage(), {
                status: 403,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        // ── / (root) und alles andere → App ───────────────────────────
        return env.ASSETS.fetch(request);
    }
};

function deniedPage() {
    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kein Zugang</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0D1117;color:#E6EDF3;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:16px;text-align:center;padding:24px}
  h1{font-size:56px;margin:0}
  p{color:#8B949E;font-size:15px;max-width:320px}
  a{color:#4ECDC4;font-weight:700}
</style>
</head>
<body>
  <h1>🔐</h1>
  <h2>Kein Zugang</h2>
  <p>Das Admin Panel ist passwortgeschützt.<br>
     Ruf die Seite mit dem richtigen Key auf:<br><br>
     <code>/admin-panel/?key=DEIN_KEY</code></p>
  <a href="/">← Zur App</a>
</body>
</html>`;
}
