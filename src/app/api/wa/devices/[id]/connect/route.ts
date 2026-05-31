import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// POST - ربط جهاز عبر QR
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const device = await prisma.waDevice.findUnique({ where: { id: params.id } });
    if (!device) return NextResponse.json({ error: "الجهاز غير موجود" }, { status: 404 });

    // هنا يتم إنشاء QR Code والاتصال بواتساب
    // const qr = await whatsappService.connect(device.phoneNumber);

    await prisma.waDevice.update({
      where: { id: params.id },
      data: { status: "CONNECTING" },
    });

    return NextResponse.json({ message: "جاري الاتصال...", device });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
