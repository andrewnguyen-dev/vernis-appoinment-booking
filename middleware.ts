import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Owner routes protection - only check for session cookie existence
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/catalog') || pathname.startsWith('/clients') || pathname.startsWith('/staffs') || pathname.startsWith('/settings')) {
    const sessionCookie = getSessionCookie(request);
    
    // THIS IS NOT SECURE - only optimistic redirect
    // Real auth checks happen in each page/route
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/owner-sign-in', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/catalog/:path*',
    '/clients/:path*',
    '/staffs/:path*',
    '/settings/:path*'
  ]
};
