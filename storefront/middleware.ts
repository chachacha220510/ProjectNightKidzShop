import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get response to add cookies to
  const response = NextResponse.next();
  
  // For debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Middleware running, URL:', request.url);
    console.log('Cookies:', request.cookies.getAll());
  }

  // Add CORS headers for API routes to ensure they work in production
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}

// This ensures the middleware runs on all routes
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}; 