export type SessionType = "mommy" | "beginner" | "experienced";

export interface SessionTemplate {
  type: SessionType;
  title: string;
  tagline: string;
  description: string;
  dayLabel: string;
  timeLabel: string;
  // Fixed date shown on the card — always visible regardless of auth state.
  staticDateLabel: string;
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

export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    type: "mommy",
    title: "Tuesday Evening Mahjong",
    tagline: "For players who know the rules",
    description:
      "A relaxed evening of real play for experienced players. A helper floats around if a rules question comes up.",
    dayLabel: "Tuesdays",
    timeLabel: "6:00 – 8:00 PM",
    staticDateLabel: "Tuesday, Jun 30 · 6:00 – 8:00 PM",
    priceLabel: "$40 · 2 hours",
    glyph: "竹",
    glyphColor: "#0F8A5F",
  },
  {
    type: "experienced",
    title: "Thursday Morning Mahjong",
    tagline: "For players who know the rules",
    description:
      "For players already comfortable with the game. A helper floats around if a rules question comes up.",
    dayLabel: "Thursdays",
    timeLabel: "10:00 AM – 12:00 PM",
    staticDateLabel: "Thursday, Jul 2 · 10:00 AM – 12:00 PM",
    priceLabel: "$40 · 2 hours",
    glyph: "東",
    glyphColor: "#1F5BA8",
  },
  {
    type: "beginner",
    title: "Friday Evening Mahjong",
    tagline: "For players who know the rules",
    description:
      "A relaxed evening of real play for experienced players. A helper floats around if a rules question comes up.",
    dayLabel: "Fridays",
    timeLabel: "4:00 – 6:00 PM",
    staticDateLabel: "Friday, Jul 3 · 4:00 – 6:00 PM",
    priceLabel: "$40 · 2 hours",
    glyph: "南",
    glyphColor: "#B8302A",
  },
];
