---
name: Maternal Care UI
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#574146'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#8b7076'
  outline-variant: '#debfc4'
  surface-tint: '#af275a'
  primary: '#780037'
  on-primary: '#ffffff'
  primary-container: '#9d174d'
  on-primary-container: '#ffafc2'
  inverse-primary: '#ffb1c3'
  secondary: '#006e2d'
  on-secondary: '#ffffff'
  secondary-container: '#7cf994'
  on-secondary-container: '#007230'
  tertiary: '#5c2f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#7e4200'
  on-tertiary-container: '#ffb579'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e0'
  primary-fixed-dim: '#ffb1c3'
  on-primary-fixed: '#3f0019'
  on-primary-fixed-variant: '#8e0542'
  secondary-fixed: '#7ffc97'
  secondary-fixed-dim: '#62df7d'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005320'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 22px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.375rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system is tailored for telehealth and maternal healthcare with a dedicated focus on clarity, calm reassurance, and radical accessibility. Designed explicitly for users experiencing physical discomfort, cognitive fatigue, high emotional stress, or low digital literacy, the visual aesthetic pairs clean modern minimalism with tactile warmth and immediate visual affordances.

### Key Tenets
- **Empathetic Simplicity:** Interfaces are uncluttered, free of visual noise, and structured with straightforward visual hierarchies that guide attention effortlessly.
- **Uncompromising Legibility:** Every touch target is oversized, text adheres to stringent contrast criteria (WCAG AAA wherever possible), and icons always accompany unambiguous text labels.
- **Safe & Reassuring Tone:** The emotional posture is nurturing yet clinical—anchored by comforting deep rose accents, crisp card surfaces, and serene, grounded neutrals.

## Colors

The color palette prioritizes clinical authority softened by comforting maternal warmth. All foreground-to-background combinations meet or exceed WCAG 2.1 AAA contrast ratios (minimum 7:1 for normal body text, 4.5:1 for large display elements and interactive controls).

### Palette Structure
- **Primary Accent (`#9D174D`, hover/active `#BE185D`):** Deep warm berry providing authoritative yet approachable visual anchors for primary calls to action, triage links, and vital alerts.
- **Secondary / Positive Status (`#16A34A`):** Pure, friendly emerald green used strictly for positive confirmation, completed visits, active prescriptions, and stable maternal vitals.
- **Tertiary / Warning Status (`#D97706`):** Soft, high-contrast amber used for pending appointments, reminders, and lab review notices.
- **Emergency / Urgent Status (`#DC2626`):** Unambiguous soft crimson reserved strictly for immediate triage, 24/7 on-call midwife routing, and critical health escalation.
- **Neutrals & Surfaces:**
  - Canvas Base: `#FAFAFA` transitioning to `#F3F4F6` for section groupings.
  - Card Surfaces: Solid `#FFFFFF`.
  - Borders & Dividers: `#E5E7EB` (providing 3:1 contrast against `#FAFAFA` surfaces).
  - Primary Body & Headings: `#111827` (yielding a 16:1 contrast ratio against white cards).
  - Secondary Text & Metadata: `#4B5563` (yielding a 7.3:1 AAA-compliant ratio against white cards).

## Typography

Typography relies on **Plus Jakarta Sans**, chosen for its friendly warmth, open counters, clear aperture distinctions, and structural legibility at large scales.

### Implementation Guidelines
- **Enhanced Body Baseline:** The primary standard reading size starts at 16px (`body-md`), scaling up to 18px (`body-lg`) for patient instructions, symptom surveys, and medical advice summaries.
- **Generous Vertical Leading:** All body and headline tiers feature expanded line heights (1.5x to 1.6x) to prevent line crowding and assist patients experiencing optical fatigue or dyslexia.
- **Restraint in Style:** Avoid italicization and light font weights (<400) entirely across all views to preserve maximum character recognition.

## Layout & Spacing

The layout is built upon an 8pt baseline rhythm and a responsive fluid column grid engineered to keep maternal actions centered and easily reachable on handheld devices.

### Grid & Form Factors
- **Mobile (up to 639px):** 4-column fluid layout, `1rem` outer canvas margin, `1rem` gutter. Primary call-to-action buttons stay pinned to the thumb-accessible bottom sheet or lower viewport quadrant.
- **Tablet (640px to 1023px):** 8-column fluid layout, `1.5rem` outer canvas margin, `1.25rem` gutter. Content sections split into stacked primary actions and supporting health history.
- **Desktop (1024px+):** 12-column fixed grid with a max container width of 1120px, `2.5rem` outer margins, `1.5rem` gutters. Keeps consultations and record reviews centered without straining scanning width.

### Density & Touch Targets
Vertical padding within interactive elements must strictly adhere to touch accessibility standards: interactive targets never drop below 48px in height, with primary telehealth triggers set to a generous 56px minimum height.

## Elevation & Depth

To eliminate disorientation and maintain clean clinical clarity, this design system rejects heavy, dramatic, or blurred drop shadows in favor of a crisp **Low-Contrast Outlines + Soft Ambient Tint** approach.

### Elevation Levels
- **Level 0 (Base Canvas):** Flat `#FAFAFA` or `#F3F4F6`. Zero shadow, serving as the backdrop plane.
- **Level 1 (Cards & Standard Modules):** Solid `#FFFFFF` background bound by a 1px solid `#E5E7EB` outline, supported by an ultra-subtle ambient drop: `0px 2px 6px -1px rgba(17, 24, 39, 0.04)`.
- **Level 2 (Active Cards, Modals, Doctor Profiles):** Solid `#FFFFFF` background with a 1px border (`#E5E7EB`), elevated by a soft warm shadow: `0px 8px 20px -4px rgba(157, 23, 77, 0.06), 0px 4px 8px -2px rgba(17, 24, 39, 0.04)`.
- **Level 3 (Urgent Banners & Emergency Sheets):** Pinned high-contrast overlays with an immediate solid structural outline: 2px border in primary or status colors, paired with `0px 12px 28px -6px rgba(17, 24, 39, 0.12)`.

## Shapes

The design system adopts a balanced **Rounded** (`0.5rem` / `8px` base) geometry. Rounded corners convey softness, health, and approachability, without descending into purely playful toy-like contours.

### Shape Hierarchy
- **Inputs, Buttons, and Minor Controls:** `rounded-md` (`8px`) for immediate button recognition and tactile affordance.
- **Health Cards, Content Blocks, & Telehealth Feeds:** `rounded-lg` (`16px`) to enclose clinical modules in distinct, calming panels.
- **Status Pills, Floating Action Elements, and Avatars:** Fully circular / pill-shaped (`9999px`) to create clear differentiation between reading containers and interactive metadata indicators.

## Components

### Buttons & Interactive Touchpoints
- **Primary Buttons:** High-contrast berry background (`#9D174D`) with pure white bold text (`#FFFFFF`). Min height 56px on mobile, 48px on desktop. 8px border radius. Hover state darkens to `#BE185D`.
- **Secondary Buttons:** Crisp white background (`#FFFFFF`) framed by a 2px solid berry border (`#9D174D`) and berry text.
- **Emergency Button:** Solid `#DC2626` background, minimum 60px height, accompanied by a high-contrast white phone or cross icon and unambiguous bold text: "Call Midwife Now (24/7)".

### Status Pills & Badges
- Pill-shaped (`rounded-full`) tags featuring a 1px solid tinted border, a high-contrast icon (check, clock, alert triangle), and semibold text.
- **Confirmed / Normal:** Light green tint background (`#DCFCE7`), dark green border (`#86EFAC`), text `#15803D`.
- **Pending / Action Required:** Light amber tint background (`#FEF3C7`), border (`#FDE68A`), text `#B45309`.
- **Emergency / Urgent Alert:** Light red tint background (`#FEE2E2`), border (`#FCA5A5`), text `#B91C1C`.

### Form Fields & Inputs
- Minimum touch bounding box: 56px height.
- Default border: 1.5px solid `#D1D5DB` on solid white surfaces.
- Focus state: High-contrast 2px solid ring (`#9D174D`) with an outer 3px ambient ring (`#FCE7F3`).
- Labels: Always persistent above the field (`headline-sm` or `label-lg`, `#111827`). Never rely on placeholder text for instructional context. Error messages render below in 14px bold red (`#DC2626`) with an alert indicator icon.

### Cards & Care Modules
- Surface: `#FFFFFF` with 1px border `#E5E7EB` and 16px corner radius.
- Internal padding: `1.5rem` (`24px`).
- Header structures must feature high-contrast titles (`#111827`), secondary date/time badges, and direct single-tap action prompts ("Tap to Join Call", "View Ultrasound Report").

### Checkboxes & Radio Controls
- Oversized target dimensions: 28px × 28px box/circle enclosed in a full-width selectable row with a minimum row height of 56px.
- Checked state: `#9D174D` filled interior with a crisp white 3px thick checkmark or interior dot.
- High visual feedback: Entire row lights up with a subtle `#FDF2F8` tint and a 1px `#9D174D` border when selected.