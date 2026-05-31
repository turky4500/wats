import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET - جلب جميع الباقات
export async function GET() {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sort: "asc" },
    });
    return NextResponse.json({ plans });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - إنشاء باقة جديدة (أدمن)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: body.name,
        nameAr: body.nameAr,
        description: body.description,
        price: body.price,
        duration: body.duration,
        features: body.features || [],
        maxDevices: body.maxDevices || 1,
        maxMessages: body.maxMessages || -1,
        maxContacts: body.maxContacts || -1,
        hasApi: body.hasApi || false,
        hasWebhooks: body.hasWebhooks || false,
        hasAutomation: body.hasAutomation || false,
        hasBroadcast: body.hasBroadcast || false,
        priority: body.priority || false,
        support: body.support || "BASIC",
        isPopular: body.isPopular || false,
      },
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
