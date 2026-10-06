import crypto from 'node:crypto';
import { AdminAccountModel } from '../models/adminAccountModel.js';

const COOKIE_NAME = 'upba_admin';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const loginAttempts = new Map();

function sessionSecretConfigured() {
  return process.env.ADMIN_SESSION_SECRET?.length >= 32;
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

function signedToken(expires, nonce, sessionVersion) {
  return crypto
    .createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
    .update(`${expires}.${nonce}.${sessionVersion}`)
    .digest('base64url');
}

function readCookie(req) {
  const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
  return cookie?.slice(COOKIE_NAME.length + 1) || '';
}

function attemptState(ip) {
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || now - current.startedAt >= LOGIN_WINDOW) {
    return { startedAt: now, count: 0, blockedUntil: 0 };
  }
  return current;
}

function isRateLimited(req, res) {
  const ip = req.ip || 'unknown';
  const attempts = attemptState(ip);
  if (attempts.blockedUntil > Date.now()) {
    res.set('Retry-After', String(Math.ceil((attempts.blockedUntil - Date.now()) / 1000)));
    res.status(429);
    return true;
  }
  return false;
}

function recordFailedAttempt(req) {
  const ip = req.ip || 'unknown';
  const attempts = attemptState(ip);
  attempts.count += 1;
  if (attempts.count >= MAX_ATTEMPTS) attempts.blockedUntil = Date.now() + LOGIN_WINDOW;
  loginAttempts.set(ip, attempts);
}

function establishSession(res, account) {
  const expires = Date.now() + SESSION_TTL;
  const nonce = crypto.randomBytes(24).toString('base64url');
  const version = String(account.session_version);
  const signature = signedToken(expires, nonce, version);
  const token = `${expires}.${nonce}.${version}.${signature}`;
  res.setHeader('Set-Cookie', cookieOptions(token, Math.floor(SESSION_TTL / 1000)));
}

export async function loginPage(req, res) {
  const setupMode = !await AdminAccountModel.hasAccount();
  res.render('admin-login', {
    error: null,
    setupMode,
    notice: req.query.updated === '1' ? 'Admin credentials updated. Sign in with your new credentials.' : null
  });
}

export async function setupAdmin(req, res) {
  if (!sessionSecretConfigured()) {
    return res.status(503).render('admin-login', {
      error: 'Set ADMIN_SESSION_SECRET to a random value of at least 32 characters before setting up the admin account.',
      setupMode: true,
      notice: null
    });
  }
  if (isRateLimited(req, res)) {
    return res.render('admin-login', { error: 'Too many attempts. Try again later.', setupMode: true, notice: null });
  }

  const { setup_token: setupToken, username: usernameInput, password, confirm_password: confirmPassword } = req.body || {};
  const username = typeof usernameInput === 'string' ? usernameInput.trim() : '';
  const invalid = !/^[a-zA-Z0-9._-]{3,50}$/.test(username) ||
    typeof setupToken !== 'string' || setupToken.length > 128 ||
    typeof password !== 'string' || password.length < 12 || password.length > 128 ||
    password !== confirmPassword;
  if (invalid) {
    recordFailedAttempt(req);
    return res.status(400).render('admin-login', {
      error: 'Enter a valid setup code, username (3–50 letters, numbers, dot, dash or underscore), and matching password (12–128 characters).',
      setupMode: true,
      notice: null
    });
  }

  const account = await AdminAccountModel.createFirstAdmin({ setupToken, username, password });
  if (!account) {
    recordFailedAttempt(req);
    return res.status(401).render('admin-login', {
      error: 'Setup code is invalid or setup has already been completed. Restart the server to generate a fresh setup code.',
      setupMode: true,
      notice: null
    });
  }

  loginAttempts.delete(req.ip || 'unknown');
  establishSession(res, account);
  res.redirect('/admin');
}

export async function login(req, res) {
  if (!sessionSecretConfigured()) {
    return res.status(503).render('admin-login', {
      error: 'Admin sessions are not configured. Set ADMIN_SESSION_SECRET to at least 32 random characters.',
      setupMode: false,
      notice: null
    });
  }
  if (isRateLimited(req, res)) {
    return res.render('admin-login', { error: 'Too many attempts. Try again later.', setupMode: false, notice: null });
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.slice(0, 100) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 256) : '';
  const account = await AdminAccountModel.authenticate(username, password);
  if (!account) {
    recordFailedAttempt(req);
    return res.status(401).render('admin-login', {
      error: 'Username or password is incorrect.',
      setupMode: false,
      notice: null
    });
  }

  loginAttempts.delete(req.ip || 'unknown');
  establishSession(res, account);
  res.redirect('/admin');
}

export function logout(req, res) {
  res.setHeader('Set-Cookie', cookieOptions('', 0));
  res.redirect('/admin/login');
}

async function validSession(req) {
  if (!sessionSecretConfigured()) return false;
  const [expiresText, nonce, versionText, signature, extra] = readCookie(req).split('.');
  const expires = Number(expiresText);
  if (!expiresText || !nonce || !versionText || !signature || extra !== undefined || expires <= Date.now()) return false;
  if (!/^\d+$/.test(versionText)) return false;
  if (!secureEqual(signature, signedToken(expiresText, nonce, versionText))) return false;

  const account = await AdminAccountModel.getById(1);
  if (!account || String(account.session_version) !== versionText) return false;
  req.adminAccount = account;
  return true;
}

export async function requireAdmin(req, res, next) {
  try {
    if (await validSession(req)) return next();
    if (!sessionSecretConfigured()) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(503).json({ error: 'Admin session signing is not configured on the server.' });
      }
      return res.status(503).render('admin-login', {
        error: 'Admin session signing is not configured on the server.',
        setupMode: false,
        notice: null
      });
    }

    if (!await AdminAccountModel.hasAccount()) {
      if (req.originalUrl.startsWith('/api/')) return res.status(503).json({ error: 'Complete the initial admin setup first.' });
      return res.redirect('/admin/login');
    }
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Admin login required.' });
    return res.redirect('/admin/login');
  } catch (error) {
    return next(error);
  }
}
