-- نوع رسالة اختبار الإرسال
ALTER TYPE "public"."OutboundMessageType" ADD VALUE IF NOT EXISTS 'TEST';

-- إعدادات المنصة العامة: إعداد واتساب من الواجهة بدل متغيرات البيئة
CREATE TABLE "public"."AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'app',
    "whatsappProvider" TEXT NOT NULL DEFAULT 'stub',
    "whatsappApiUrl" TEXT,
    "whatsappApiToken" TEXT,
    "whatsappSender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);
