-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "linkPrecedence" SET DEFAULT 'primary';

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_phoneNumber_idx" ON "Contact"("phoneNumber");
