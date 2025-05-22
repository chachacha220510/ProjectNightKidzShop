import { NextResponse } from 'next/server';

export async function GET() {
  // Only return non-sensitive environment variables
  const env = {
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  return NextResponse.json({
    env,
    timestamp: new Date().toISOString(),
  });
} 