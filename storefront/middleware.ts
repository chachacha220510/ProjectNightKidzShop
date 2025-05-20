import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // This empty middleware ensures we can properly handle cookies
  return NextResponse.next();
}

// This ensures the middleware runs on all routes
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}; 