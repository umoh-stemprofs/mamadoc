-- Step 4B: "Add day off" now asks for a reason, shown on the day card.
ALTER TABLE "TimeOff" ADD COLUMN "reason" TEXT;
