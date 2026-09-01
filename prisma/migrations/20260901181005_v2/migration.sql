/*
  Warnings:

  - You are about to drop the column `isSystem` on the `roles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "roles" DROP COLUMN "isSystem",
ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false;
