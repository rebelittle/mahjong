// Hand-written types matching the SQL schema in supabase/migrations/.
// Shape matches what @supabase/supabase-js expects so the typed client narrows
// queries correctly. Args on RPCs are intentionally non-optional — optional
// fields would collapse to `Record<PropertyKey, never>` and the rpc() signature
// would refuse arguments.

export type SessionType = "mommy" | "beginner" | "experienced" | "openplay";
export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type SeatPosition = "east" | "south" | "west" | "north";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  photo_url: string | null;
  skill_level: SkillLevel | null;
  notes: string | null;
  is_helper: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionTemplate {
  id: string;
  type: SessionType;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

export interface SessionRow {
  id: string;
  template_id: string | null;
  type: SessionType;
  starts_at: string;
  ends_at: string;
  status: "open" | "cancelled";
  notes: string | null;
  created_at: string;
}

export interface Seat {
  id: string;
  session_id: string;
  table_number: number;
  seat_position: SeatPosition;
  profile_id: string | null;
  reserved_at: string | null;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "email" | "display_name">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      session_templates: {
        Row: SessionTemplate;
        Insert: Partial<SessionTemplate>;
        Update: Partial<SessionTemplate>;
        Relationships: [];
      };
      sessions: {
        Row: SessionRow;
        Insert: Partial<SessionRow>;
        Update: Partial<SessionRow>;
        Relationships: [];
      };
      seats: {
        Row: Seat;
        Insert: Partial<Seat>;
        Update: Partial<Seat>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ensure_sessions_materialized: {
        Args: { weeks_ahead: number; start_from?: string };
        Returns: undefined;
      };
      claim_seat: {
        Args: { p_seat_id: string };
        Returns: Seat;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
