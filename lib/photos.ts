// Doctor photos from the maternal-care mockups (Google-hosted images, the
// style the user approved). The schema has no photo column, so the seeded
// doctors map to the mockup portraits by name; any other doctor falls back
// to letter initials in the UI.
export const DOCTOR_PHOTOS: Record<string, string> = {
  'Dr. Amaka Obi': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvSvv2EhU3MRm-ooza9n9-nsFmkPBPkmy8j5fsQIXoXp44mhnyQ2P8UD2AmYViXjARI_rFCWlIqXRhWIDHCkyEQmF6LYQEfzO1p2IaC3OGVDXFLSL5k-8mZ0ot1bxfYf4y0ITQIidyIOtEkfMGzv7myZ532xJktoVa0uAHy5vpPuFApsDtZxpEMSZN4Q-0SdHYxp-ZHu8V2HCO31xFiZFLJwgplO5GNHbnNanHLCxgXhAAGxn8LQNStg',
  'Dr. Zainab Yusuf': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAuM37QWe4iT3v-MmE3Hcho5NQOX_V6CZaw7p1uBACG_1XkRtLnBm77wynzyO5xL1ruuT9cTUivC3XqrSTZdcqSbIsOvqPRoGAjCiAl2JlZD5JoKj3XRxCMX7VoGBIDyLK4juDeLmVKbgiTc6RS2PTwksIaqbZUKb3YhjvjNvbwdzefwbK9NcpbwNZTuHyHnNzGzYVpL6Z9DMO_i7YOx6GBDl49-wQH7ewEGh9zX2Ke48zZ8yfX8To7Ow',
}

/** The mockup portrait for a doctor, or null when the UI should use initials. */
export function doctorPhoto(name: string): string | null {
  return DOCTOR_PHOTOS[name] ?? null
}
