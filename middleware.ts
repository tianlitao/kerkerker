import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'experimental-edge';

const SESSION_COOKIE_NAME = 'admin_session';

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

async function validateSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  const [version, expiresAtRaw, signature, ...rest] = token.split('.');

  if (rest.length > 0 || version !== 'v1' || !expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const secret =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    'admin123';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${version}.${expiresAtRaw}`)
  );

  return safeEqual(signature, bytesToBase64Url(new Uint8Array(expected)));
}

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith('/admin') &&
    !(await validateSessionToken(
      request.cookies.get(SESSION_COOKIE_NAME)?.value
    ))
  ) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set(
      'redirect',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*'
};
