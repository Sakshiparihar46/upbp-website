import crypto from 'node:crypto';

const COOKIE_NAME = 'upba_admin';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const loginAttempts = new Map();

function credentialsConfigured() {
  return Boolean(
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_SESSION_SECRET?.length >= 32
  );
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function cookieOptions(value, maxAge) {
  return [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : [])
  ].join('; ');
}

function signedToken(expires, nonce) {
  return crypto
    .createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
    .update(`${expires}.${nonce}`)
    .digest('base64url');
}

function readCookie(req) {
  const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
  return cookie?.slice(COOKIE_NAME.length + 1) || '';
}

function validSession(req) {
  if (!credentialsConfigured()) return false;
  const [expiresText, nonce, signature, extra] = readCookie(req).split('.');
  const expires = Number(expiresText);
  if (!expiresText || !nonce || !signature || extra !== undefined || expires <= Date.now()) return false;
  return secureEqual(signature, signedToken(expiresText, nonce));
}

function attemptState(ip) {
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || now - current.startedAt >= LOGIN_WINDOW) {
    return { startedAt: now, count: 0, blockedUntil: 0 };
  }
  return current;
}

export function login(req, res) {
  if (!credentialsConfigured()) {
    return res.status(503).render('admin-login', { error: 'Admin credentials are not configured on the server.' });
  }

  const ip = req.ip || 'unknown';
  const attempts = attemptState(ip);
  if (attempts.blockedUntil > Date.now()) {
    res.set('Retry-After', String(Math.ceil((attempts.blockedUntil - Date.now()) / 1000)));
    return res.status(429).render('admin-login', { error: 'Too many attempts. Try again later.' });
  }

  const validUsername = secureEqual(String(req.body?.username || ''), process.env.ADMIN_USERNAME);
  const validPassword = secureEqual(String(req.body?.password || ''), process.env.ADMIN_PASSWORD);
  if (!validUsername || !validPassword) {
    attempts.count += 1;
    if (attempts.count >= MAX_ATTEMPTS) attempts.blockedUntil = Date.now() + LOGIN_WINDOW;
    loginAttempts.set(ip, attempts);
    return res.status(401).render('admin-login', { error: 'Username or password is incorrect.' });
  }

  loginAttempts.delete(ip);
  const expires = Date.now() + SESSION_TTL;
  const nonce = crypto.randomBytes(24).toString('base64url');
  const token = `${expires}.${nonce}.${signedToken(expires, nonce)}`;
  res.setHeader('Set-Cookie', cookieOptions(token, Math.floor(SESSION_TTL / 1000)));
  res.redirect('/admin');
}

export function logout(req, res) {
  res.setHeader('Set-Cookie', cookieOptions('', 0));
  res.redirect('/admin/login');
}

export function requireAdmin(req, res, next) {
  if (validSession(req, res)) return next();
  if (!credentialsConfigured()) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(503).json({ error: 'Admin login is not configured on the server.' });
    }
    return res.status(503).render('admin-login', { error: 'Admin credentials are not configured on the server.' });
  }
  if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Admin login required.' });
  return res.redirect('/admin/login');
}
