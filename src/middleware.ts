import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("next-auth.session-token") || request.cookies.get("__Secure-next-auth.session-token");
  const pathname = request.nextUrl.pathname;

  // حماية مسارات الأدمن
  if (pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/auth/login?callbackUrl=/admin/dashboard", request.url));
    }
    // يمكن التحقق من الدور هنا عبر API
  }

  // حماية مسارات المستخدم
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/profile") || pathname.startsWith("/messages")) {
    if (!token) {
      return NextResponse.redirect(new URL("/auth/login?callbackUrl=" + encodeURIComponent(pathname), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/profile/:path*", "/messages/:path*"],
};
