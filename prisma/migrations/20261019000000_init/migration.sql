-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CANCELLED', 'DONE', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TriageLevel" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "AppointmentReason" AS ENUM ('ROUTINE', 'PROBLEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "triageLevel" "TriageLevel" NOT NULL,
    "reason" "AppointmentReason" NOT NULL,
    "symptomsJson" TEXT NOT NULL DEFAULT '[]',
    "weeks" INTEGER,
    "severe" BOOLEAN NOT NULL DEFAULT false,
    "meetingUrl" TEXT,
    "slotKey" TEXT,
    "patientSlotKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthProfile" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encPayload" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthFile" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "encData" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_doctorId_weekday_idx" ON "AvailabilityRule"("doctorId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_doctorId_weekday_startTime_key" ON "AvailabilityRule"("doctorId", "weekday", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "TimeOff_doctorId_date_key" ON "TimeOff"("doctorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_slotKey_key" ON "Appointment"("slotKey");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_patientSlotKey_key" ON "Appointment"("patientSlotKey");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_date_idx" ON "Appointment"("doctorId", "date");

-- CreateIndex
CREATE INDEX "Appointment_patientId_date_idx" ON "Appointment"("patientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HealthProfile_patientId_key" ON "HealthProfile"("patientId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_toUserId_createdAt_idx" ON "EmailOutbox"("toUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_patientId_at_idx" ON "AccessLog"("patientId", "at");

-- CreateIndex
CREATE INDEX "LoginAttempt_key_at_idx" ON "LoginAttempt"("key", "at");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthProfile" ADD CONSTRAINT "HealthProfile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthFile" ADD CONSTRAINT "HealthFile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Step-1 extra constraints (00-global.md §4 Health base + 13-mamadoc.md)

-- AvailabilityRule: weekday 0-6, allowed slot lengths, HH:mm formats, end after start
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_weekday_range" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_slot_minutes_allowed" CHECK ("slotMinutes" IN (15, 20, 30, 45, 60));
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_start_time_format" CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_end_time_format" CHECK ("endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_end_after_start" CHECK ("endTime" > "startTime");

-- Appointment: formats, duration, pregnancy weeks 1-42 or NULL ("Not sure")
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_date_format" CHECK ("date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_time_format" CHECK ("time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_duration_positive" CHECK ("durationMin" > 0);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_weeks_range" CHECK ("weeks" IS NULL OR "weeks" BETWEEN 1 AND 42);

-- No double booking: belt and braces on top of the slotKey/patientSlotKey uniques.
-- A slot is held while a BOOKED row exists; cancelling frees it (status changes AND keys are nulled).
CREATE UNIQUE INDEX "Appointment_doctor_date_time_booked_key" ON "Appointment"("doctorId", "date", "time") WHERE "status" = 'BOOKED';
CREATE UNIQUE INDEX "Appointment_patient_date_time_booked_key" ON "Appointment"("patientId", "date", "time") WHERE "status" = 'BOOKED';
