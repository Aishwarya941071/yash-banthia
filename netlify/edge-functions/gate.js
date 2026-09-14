// Password-gates everything under /market-tool/*.
// Enforced server-side (Netlify Edge Function), not in client JS, so it
// can't be bypassed by viewing page source or disabling JS.

const COOKIE_NAME = 'mt_auth';
const COOKIE_PATH = '/market-tool';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loginPage({ failed = false } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Market Tool — Sign In</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>
  :root{ --paper:#fbf6f7; --ink:#182228; --ink-soft:#3d5560; --forest-strong:#3f7590; --line:#d6dade; --danger:#a13f2c; }
  *{box-sizing:border-box;}
  body{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--paper); color:var(--ink); font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif; }
  .card{ width:100%; max-width:340px; padding:32px; border:1px solid var(--line); border-radius:8px; background:#fff; }
  h1{ font-family:'Newsreader',Georgia,serif; font-weight:600; font-size:1.3rem; margin:0 0 6px; }
  p{ color:var(--ink-soft); font-size:0.88rem; margin:0 0 20px; }
  input[type=password]{ width:100%; padding:11px 12px; border:1px solid var(--line); border-radius:5px; font-size:0.95rem; margin-bottom:12px; }
  button{ width:100%; padding:11px; border:none; border-radius:5px; background:var(--forest-strong); color:#fff; font-size:0.9rem; cursor:pointer; }
  button:hover{ opacity:0.9; }
  .error{ color:var(--danger); font-size:0.82rem; margin:-4px 0 14px; }
</style>
</head>
<body>
  <div class="card">
    <h1>Market Tool</h1>
    <p>This page is private. Enter the password to continue.</p>
    ${failed ? '<div class="error">Incorrect password. Try again.</div>' : ''}
    <form method="POST" action="/market-tool/__gate">
      <input type="password" name="password" placeholder="Password" autofocus required>
      <button type="submit">Enter</button>
    </form>
  </div>
</body>
</html>`;
}

export default async (request, context) => {
  const password = Deno.env.get('MARKET_TOOL_PASSWORD');
  if (!password) {
    return new Response('Server misconfigured: MARKET_TOOL_PASSWORD is not set.', { status: 500 });
  }

  const url = new URL(request.url);
  const expectedToken = await sha256Hex(password);

  if (request.method === 'POST' && url.pathname === '/market-tool/__gate') {
    const form = await request.formData();
    const entered = form.get('password');
    if (entered === password) {
      const headers = new Headers();
      headers.set('Location', '/market-tool/');
      headers.append(
        'Set-Cookie',
        `${COOKIE_NAME}=${expectedToken}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`
      );
      return new Response(null, { status: 302, headers });
    }
    return new Response(loginPage({ failed: true }), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const cookies = request.headers.get('cookie') || '';
  const authed = cookies
    .split(';')
    .map((c) => c.trim())
    .includes(`${COOKIE_NAME}=${expectedToken}`);

  if (!authed) {
    return new Response(loginPage(), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return context.next();
};
