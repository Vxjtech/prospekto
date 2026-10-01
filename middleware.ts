import { NextResponse, type NextRequest } from 'next/server';
export function middleware(request:NextRequest){const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');if(!['/','/databaze','/databaze/'].includes(request.nextUrl.pathname))response.headers.set('X-Robots-Tag','noindex, nofollow');return response;}
export const config={matcher:['/','/databaze/:path*','/panel/:path*','/registrace/:path*','/prihlaseni/:path*','/api/panel/:path*']};
