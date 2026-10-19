# MamaDoc — maternal triage and priority booking

Health track prototype (STEM Festival). Accent #AD1457.

> **For non-emergency visits only. In an emergency call 112.**
> **Prototype. Not for diagnosis or treatment.**

**Status: step 1 complete — schema + seed + database constraints**
(00-global.md §4 Health base + 13-mamadoc.md. Triage/queue logic, tests and screens come in later steps.)

## Setup

```bash
npm install                     # only inside this folder
# create .env from .env.example and fill in real values (.env is git-ignored)
npm run db:deploy              # create tables + double-booking constraints
npm run db:seed                # seed demo data (safe to re-run: it wipes first)
npm run verify:constraints     # prove double booking is blocked at the DB level
npm run dev                    # http://localhost:3300 (needs the Next.js install of a later step)
```

## Environment variables

`.env` is git-ignored — real values never leave the machine. `.env.example` has placeholders.

| Name | Meaning |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (secret) |
| `HEALTH_DATA_KEY` | 32 random bytes, base64 — AES-256-GCM key for health data |
| `SESSION_SECRET` | session cookie secret |
| `EMERGENCY_NUMBER` | 112 (Nigerian national emergency number — confirm locally) |
| `APP_TZ` | Africa/Lagos — all dates/times use this zone |
| `DEMO_MODE` | show "Try demo" buttons once the screens exist |

## Demo accounts (seeded)

**Demo password: `mamadocdemo1`** (README only — never printed by the app or seed)

| Role | Name | Email |
|---|---|---|
| Doctor | Dr. Amaka Obi | amaka.obi@mamadoc.demo |
| Doctor | Dr. Zainab Yusuf | zainab.yusuf@mamadoc.demo |
| Patient | Chioma Eze | chioma.eze@mamadoc.demo |
| Patient | Fatima Bello | fatima.bello@mamadoc.demo |
| Patient | Ngozi Okafor | ngozi.okafor@mamadoc.demo |

## Seed data

- 2 antenatal doctors with weekly availability rules (every weekday covered, 30/45/60-minute slots) and one day off for Dr. Yusuf
- 3 patients (Chioma 28 weeks, Ngozi 34 weeks, Fatima "not sure")
- **Today's queue** for whichever doctor works today: 2 urgent + 3 normal bookings on the same day
  - one normal with reason PROBLEM ("Has a problem" tag next to Normal)
  - one urgent booked with reason ROUTINE (Q1 never changes the triage level)
  - `createdAt` staggered so the queue must sort urgent by createdAt and normal by time
- Past DONE visits (one normal, one urgent with severe bleeding), past and future CANCELLED visits, one upcoming booked visit
- A notification + simulated email for every visit, for **both** patient and doctor

## Database constraints (no double booking)

- `Appointment.slotKey` UNIQUE — `doctorId|date|time`, nulled on cancel
- `Appointment.patientSlotKey` UNIQUE — `patientId|date|time`, nulled on cancel
- Partial UNIQUE `(doctorId, date, time) WHERE status = 'BOOKED'`
- Partial UNIQUE `(patientId, date, time) WHERE status = 'BOOKED'`
- CHECKs: weekday 0–6 · slotMinutes ∈ {15,20,30,45,60} · `HH:mm` formats · endTime > startTime · durationMin > 0 · weeks 1–42 or NULL · date format `YYYY-MM-DD`

`npm run verify:constraints` inserts probe rows against the live database, proves each one is rejected, then removes them.

## Next steps (13-mamadoc.md)

- [x] Step 1: schema + seed (+ constraints)
- [ ] Step 2: `lib/triage.ts` + tests
- [ ] Step 3: `lib/queue.ts` + tests
- [ ] Step 4: urgent slot window (3 days) + "no slot → emergency" test
- [ ] Step 5: wizard pages
- [ ] Step 6: doctor queue page
- [ ] Step 7: click-through normal / urgent / severe
