import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

// Session cookie 名称
export const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_TOKEN_VERSION = 'v1';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionTokenOptions {
  secret?: string;
  now?: number;
  maxAge?: number;
}

// 获取管理员密码（运行时动态读取环境变量，避免构建时被内联）
function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || getAdminPassword();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signSessionPayload(payload: string, secret: string): string {
  return bytesToBase64Url(hmac(sha256, secret, payload));
}

export async function signSessionPayloadEdge(
  payload: string,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}

function getSessionCookieSecureFlag(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function createSessionToken(options: SessionTokenOptions = {}): string {
  const now = options.now ?? Date.now();
  const maxAge = options.maxAge ?? SESSION_MAX_AGE_SECONDS;
  const secret = options.secret ?? getSessionSecret();
  const expiresAt = now + maxAge * 1000;
  const payload = `${SESSION_TOKEN_VERSION}.${expiresAt}`;
  const signature = signSessionPayload(payload, secret);

  return `${payload}.${signature}`;
}

export function validateSessionToken(
  token: string | undefined | null,
  options: Omit<SessionTokenOptions, 'maxAge'> = {}
): boolean {
  if (!token) {
    return false;
  }

  const [version, expiresAtRaw, signature, ...rest] = token.split('.');

  if (rest.length > 0 || version !== SESSION_TOKEN_VERSION || !expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  const now = options.now ?? Date.now();

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }

  const secret = options.secret ?? getSessionSecret();
  const expectedSignature = signSessionPayload(`${version}.${expiresAtRaw}`, secret);

  return safeEqual(signature, expectedSignature);
}

export async function validateSessionTokenEdge(
  token: string | undefined | null,
  options: Omit<SessionTokenOptions, 'maxAge'> = {}
): Promise<boolean> {
  if (!token) {
    return false;
  }

  const [version, expiresAtRaw, signature, ...rest] = token.split('.');

  if (rest.length > 0 || version !== SESSION_TOKEN_VERSION || !expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  const now = options.now ?? Date.now();

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }

  const secret = options.secret ?? getSessionSecret();
  const expectedSignature = await signSessionPayloadEdge(
    `${version}.${expiresAtRaw}`,
    secret
  );

  return safeEqual(signature, expectedSignature);
}

export function validateRequestSession(
  request: Pick<NextRequest, 'cookies'> | undefined
): boolean {
  if (!request) {
    return false;
  }

  return validateSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function validateRequestSessionEdge(
  request: Pick<NextRequest, 'cookies'> | undefined
): Promise<boolean> {
  if (!request) {
    return false;
  }

  return validateSessionTokenEdge(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

// 创建会话
export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  // 设置session cookie，有效期7天
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: getSessionCookieSecureFlag(),
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  });
}

// 删除会话
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// 验证会话
export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  return validateSessionToken(session?.value);
}

// 验证密码
export function validatePassword(password: string): boolean {
  return password === getAdminPassword();
}
