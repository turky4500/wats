import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// POST - استقبال أحداث واتساب
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, data, deviceId } = body;

    switch (type) {
      case "message.received":
        // تسجيل الرسالة المستلمة
        await prisma.waDevice.update({
          where: { id: deviceId },
          data: { messagesReceived: { increment: 1 } },
        });
        break;

      case "message.sent":
        // تحديث عداد الرسائل المرسلة
        await prisma.waDevice.update({
          where: { id: deviceId },
          data: { messagesSent: { increment: 1 } },
        });
        break;

      case "device.connected":
        await prisma.waDevice.update({
          where: { id: deviceId },
          data: { status: "CONNECTED", isConnected: true, lastConnected: new Date() },
        });
        break;

      case "device.disconnected":
        await prisma.waDevice.update({
          where: { id: deviceId },
          data: { status: "DISCONNECTED", isConnected: false },
        });
        break;

      case "qr.generated":
        await prisma.waDevice.update({
          where: { id: deviceId },
          data: { status: "QR_SCAN", qrCode: data.qr },
        });
        break;

      default:
        console.log("Unknown webhook type:", type);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
