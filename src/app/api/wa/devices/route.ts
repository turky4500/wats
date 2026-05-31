import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET - جلب جميع الأجهزة
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const where: any = {};
    if (userId) where.userId = userId;

    const devices = await prisma.waDevice.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ devices });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - إنشاء جهاز جديد
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const device = await prisma.waDevice.create({
      data: {
        userId: body.userId,
        name: body.name,
        phoneNumber: body.phoneNumber,
        platform: body.platform || "baileys",
        status: "QR_SCAN",
      },
    });

    // هنا يتم طلب QR Code من خدمة الواتساب
    // const qr = await whatsappService.getQR(device.id);

    return NextResponse.json({ device }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
