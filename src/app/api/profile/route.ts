import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET - جلب الملف الشخصي للمستخدم الحالي
export async function GET(req: Request) {
  try {
    // يمكن الحصول على userId من جلسة المستخدم عبر next-auth
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    if (!profile) return NextResponse.json({ error: "الملف الشخصي غير موجود" }, { status: 404 });

    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - تحديث الملف الشخصي
export async function PUT(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json();
    const profile = await prisma.profile.update({
      where: { userId },
      data: body,
    });

    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
