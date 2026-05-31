import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// POST - فصل جهاز
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const device = await prisma.waDevice.update({
      where: { id: params.id },
      data: { status: "DISCONNECTED", isConnected: false },
    });

    // هنا يتم فصل الجهاز من خدمة الواتساب
    // await whatsappService.disconnect(device.phoneNumber);

    return NextResponse.json({ device });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
