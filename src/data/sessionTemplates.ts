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

// Shared amenities surfaced in the "Good to know" section.
export const SESSION_AMENITIES: string[] = [
  "Snacks and drinks provided",
  "Building is well air conditioned",
  "Full sets and 2026 cards provided",
  "All you need to bring is yourself!",
];

export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    type: "mommy",
    title: "Lesson for Beginners",
    tagline: "New to Mah Jongg? You're in the right place!",
    description:
      "No experience necessary — just curiosity and a willingness to learn. We'll walk you through the basics: how to read the tiles, the rules of play, and the strategy behind building your hand. By the end, you'll feel confident enough to sit down at the table and join in the fun. Come for the lesson, stay for the community!",
    dayLabel: "Tuesdays",
    timeLabel: "6:00 – 8:00 PM",
    staticDateLabel: "Tuesday, Jun 30 · 6:00 – 8:00 PM",
    priceLabel: "$40 · 2 hours",
    glyph: "竹",
    glyphColor: "#0F8A5F",
  },
  {
    type: "experienced",
    title: "Mommy Mahj!",
    tagline: "Tiles for you, fun for them!",
    description:
      "Learn to mah jongg while your little ones play! Tova will walk you through the basics: how to read the tiles, the rules of play, and the strategy behind building your hand. Ms. Melanie will have fun summer activities planned for the kids while you learn!",
    dayLabel: "Wednesdays",
    timeLabel: "12:30 – 2:30 PM",
    staticDateLabel: "Wednesday, Jul 1 · 12:30 – 2:30 PM",
    priceLabel: "$40 · 2 hours",
    glyph: "東",
    glyphColor: "#1F5BA8",
  },
  {
    type: "beginner",
    title: "Lesson for Beginners",
    tagline: "New to Mah Jongg? You're in the right place!",
    description:
      "No experience necessary — just curiosity and a willingness to learn. We'll walk you through the basics: how to read the tiles, the rules of play, and the strategy behind building your hand. By the end, you'll feel confident enough to sit down at the table and join in the fun. Come for the lesson, stay for the community!",
    dayLabel: "Fridays",
    timeLabel: "4:00 – 6:00 PM",
    staticDateLabel: "Friday, Jul 3 · 4:00 – 6:00 PM",
    priceLabel: "$40 · 2 hours",
    glyph: "南",
    glyphColor: "#B8302A",
  },
];
