export type SessionType = "mommy" | "beginner" | "experienced";

export interface SessionTemplate {
  type: SessionType;
  title: string;
  tagline: string;
  description: string;
  dayLabel: string;
  timeLabel: string;
  // Shown at the end of the flow (e.g. session page), not on the card face.
  priceLabel?: string;
  // Used as the tile face on the session card
  glyph: string;
  glyphColor: string;
}

// Shared amenities for the evening experienced-player sessions.
// Surfaced in a "Good to know" note rather than on every card.
export const SESSION_AMENITIES: string[] = [
  "Snacks and drinks provided",
  "Building is well air conditioned",
  "Full sets and 2026 cards provided",
  "All you need to bring is yourself!",
];

// Mirrors the seeded `session_templates` rows in the Supabase migration.
// Admin can edit times once the admin UI ships; this is just the default schedule.
export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    type: "mommy",
    title: "Wednesday Evening Mahjong",
    tagline: "For players who know the rules",
    description:
      "A relaxed evening of real play for experienced players. A helper floats around if a rules question comes up.",
    dayLabel: "Wednesdays",
    timeLabel: "6:00 – 8:00 PM",
    priceLabel: "$40 · 2 hours",
    glyph: "竹",
    glyphColor: "#0F8A5F",
  },
  {
    type: "beginner",
    title: "Friday Evening Mahjong",
    tagline: "For players who know the rules",
    description:
      "A relaxed evening of real play for experienced players. A helper floats around if a rules question comes up.",
    dayLabel: "Fridays",
    timeLabel: "6:00 – 8:00 PM",
    priceLabel: "$40 · 2 hours",
    glyph: "南",
    glyphColor: "#B8302A",
  },
  {
    type: "experienced",
    title: "Experienced Players",
    tagline: "Just play",
    description:
      "For players already comfortable with the game. A helper floats around if a rules question comes up.",
    dayLabel: "Thursdays",
    timeLabel: "10:00 – 12:00",
    glyph: "東",
    glyphColor: "#1F5BA8",
  },
];
