import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { upsertMyProfile } from "../lib/dataApi";
import { initialsOf } from "../lib/utils";
import type { SkillLevel } from "../lib/database.types";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | "">("");
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setSkillLevel(profile.skill_level ?? "");
    }
  }, [profile]);

  const isNew = !profile;
  // Photo comes from the user's Google account via Clerk — no uploads.
  const photoUrl = user?.imageUrl ?? profile?.photo_url ?? null;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) {
      setErrMsg("Please enter a name.");
      return;
    }
    setSaving(true);
    setErrMsg("");
    try {
      await upsertMyProfile(user.id, user.email ?? "", {
        display_name: displayName.trim(),
        skill_level: (skillLevel || null) as SkillLevel | null,
        notes: null,
        photo_url: user.imageUrl ?? null,
      });
      await refreshProfile();
      navigate("/");
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
      <div className="mb-7">
        <p className="pill">{isNew ? "Welcome" : "Your profile"}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">
          {isNew ? "Make your place card." : "Edit your place card."}
        </h1>
        <p className="mt-2 max-w-lg text-fox-ink/75">
          This is what shows up on your chair when you reserve a seat — so other moms
          know who they're sitting with.
        </p>
      </div>

      <form onSubmit={onSave} className="card overflow-hidden">
        <div className="grid gap-7 p-7 sm:grid-cols-[180px_1fr] sm:p-9">
          <div>
            <span className="label">Photo</span>
            <div className="relative block aspect-square w-full overflow-hidden rounded-2xl border border-fox-cream-200 bg-fox-cream-50/50">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center font-display text-4xl text-fox-yellow-700/40">
                  {displayName ? initialsOf(displayName) : "·"}
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-fox-ink/50">
              Pulled from your Google account.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="label">Display name</label>
              <input
                id="name"
                type="text"
                required
                placeholder="Sarah L."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <span className="label">Skill level</span>
              <div className="flex flex-wrap gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSkillLevel(lvl)}
                    className={
                      "rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition " +
                      (skillLevel === lvl
                        ? "bg-fox-navy-700 text-fox-cream-50"
                        : "border border-fox-cream-200 bg-white text-fox-navy-700 hover:bg-fox-cream-100")
                    }
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {errMsg && (
          <p className="border-t border-tile-red/30 bg-tile-red/5 px-7 py-3 text-sm text-tile-red sm:px-9">
            {errMsg}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-fox-cream-200 bg-fox-cream-50/60 px-7 py-4 sm:px-9">
          {!isNew && (
            <button
              type="button"
              onClick={() => navigate("/")}
              className="btn-ghost"
              disabled={saving}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : isNew ? "Save and continue" : "Save changes"}
          </button>
        </div>
      </form>
    </main>
  );
}
