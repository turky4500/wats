import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// PUT - تحديث حالة المستخدم
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await req.json();
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { status },
    });
    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
