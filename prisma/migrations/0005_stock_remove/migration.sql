-- AlterEnum: إضافة نوع حركة حذف كمية من المخزون
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'REMOVE';
