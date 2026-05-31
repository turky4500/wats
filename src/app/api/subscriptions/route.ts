import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET - جلب جميع الاشتراكات
export async function GET(req: Request) {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: { user: true, plan: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ subscriptions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - إنشاء اشتراك
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const subscription = await prisma.subscription.create({
      data: {
        userId: body.userId,
        planId: body.planId,
        status: body.status || "ACTIVE",
        startDate: new Date(),
        endDate: body.endDate ? new Date(body.endDate) : null,
        autoRenew: body.autoRenew ?? true,
        paymentMethod: body.paymentMethod || "FREE",
        amount: body.amount || 0,
      },
      include: { user: true, plan: true },
    });
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
