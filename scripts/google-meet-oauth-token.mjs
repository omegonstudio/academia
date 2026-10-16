#!/usr/bin/env node
/**
 * One-shot helper: obtain GOOGLE_MEET_REFRESH_TOKEN for Academia.
 *
 * Prerequisites (Google Cloud Console → Credentials → Cliente-academia):
 *   - Application type: Web application
 *   - Authorized redirect URI exactly:
 *       http://127.0.0.1:8765/oauth2callback
 *   - Calendar API enabled
 *   - GOOGLE_MEET_CLIENT_ID / _SECRET already set in repo-root `.env`
 *
 * Usage (from repo root, on the host — not inside Docker):
 *   node scripts/google-meet-oauth-token.mjs
 *
 * Writes only GOOGLE_MEET_REFRESH_TOKEN into `.env`. Does not print secrets.
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');
const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 8765;
const REDIRECT_URI = `http://${LISTEN_HOST}:${LISTEN_PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/calendar';

function parseEnvFile(contents) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function upsertEnvVar(contents, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(contents)) {
    return contents.replace(re, line);
  }
  const suffix = contents.endsWith('\n') || contents.length === 0 ? '' : '\n';
  return `${contents}${suffix}${line}\n`;
}

function mask(value) {
  if (value.length <= 8) return '(set)';
  return `${value.slice(0, 4)}…${value.slice(-4)} (len=${value.length})`;
}

async function main() {
  let raw;
  try {
    raw = readFileSync(ENV_PATH, 'utf8');
  } catch {
    console.error(`No se encontró ${ENV_PATH}. Copiá .env.example a .env primero.`);
    process.exit(1);
  }

  const env = parseEnvFile(raw);
  const clientId = (env.GOOGLE_MEET_CLIENT_ID ?? '').trim();
  const clientSecret = (env.GOOGLE_MEET_CLIENT_SECRET ?? '').trim();

  if (!clientId || !clientSecret) {
    console.error(
      'Faltan GOOGLE_MEET_CLIENT_ID o GOOGLE_MEET_CLIENT_SECRET en .env.',
    );
    process.exit(1);
  }

  console.log('Cliente OAuth detectado:', mask(clientId));
  console.log('Redirect URI requerida en Google Cloud:', REDIRECT_URI);
  console.log('Scope:', SCOPE);
  console.log('');
  console.log(
    'Confirmá que esa URI esté en Credenciales → Cliente-academia → URIs de redirección autorizadas.',
  );
  console.log('Luego se abrirá el navegador (o pegá la URL) para autorizar.');
  console.log('');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('include_granted_scopes', 'true');

  /** @type {string} */
  const code = await new Promise((resolveCode, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://${LISTEN_HOST}:${LISTEN_PORT}`);
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404).end('Not found');
          return;
        }
        const err = url.searchParams.get('error');
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<p>Error OAuth: ${err}</p><p>Podés cerrar esta pestaña.</p>`);
          server.close();
          reject(new Error(`OAuth error: ${err}`));
          return;
        }
        const received = url.searchParams.get('code');
        if (!received) {
          res.writeHead(400).end('Missing code');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<p>Autorización OK. Podés cerrar esta pestaña y volver a la terminal.</p>',
        );
        server.close();
        resolveCode(received);
      } catch (error) {
        server.close();
        reject(error);
      }
    });

    server.listen(LISTEN_PORT, LISTEN_HOST, () => {
      console.log(`Escuchando ${REDIRECT_URI}`);
      console.log('');
      console.log('Abrí esta URL en el navegador (cuenta que administrará Meet):');
      console.log(authUrl.toString());
      console.log('');
    });

    server.on('error', reject);
  });

  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => '');
    console.error(
      'Google rechazó el intercambio del código.',
      `HTTP ${tokenRes.status}.`,
      detail.slice(0, 200),
    );
    process.exit(1);
  }

  const json = /** @type {{ refresh_token?: string; access_token?: string }} */ (
    await tokenRes.json()
  );

  if (!json.refresh_token) {
    console.error(
      'La respuesta no incluyó refresh_token. Suele pasar si ya autorizaste antes sin prompt=consent, o si el cliente no permite offline. Revocá el acceso en https://myaccount.google.com/permissions y reintentá.',
    );
    process.exit(1);
  }

  const next = upsertEnvVar(raw, 'GOOGLE_MEET_REFRESH_TOKEN', json.refresh_token);
  if (!/^GOOGLE_MEET_CALENDAR_ID=/m.test(next)) {
    writeFileSync(ENV_PATH, upsertEnvVar(next, 'GOOGLE_MEET_CALENDAR_ID', 'primary'), 'utf8');
  } else {
    writeFileSync(ENV_PATH, next, 'utf8');
  }

  console.log('');
  console.log('Listo: GOOGLE_MEET_REFRESH_TOKEN guardado en .env (sin imprimir el valor).');
  console.log('Estado:', mask(json.refresh_token));
  console.log('');
  console.log('Siguiente paso: reiniciá la API para que Compose recargue el .env.');
  console.log('  npm run dev   # o: docker compose restart api');
  console.log('Luego verificá GET /google-meet/status → configured: true');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
