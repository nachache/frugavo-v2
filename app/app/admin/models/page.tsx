import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AdminModelsTable } from "@/components/app/admin-models-table";

// /app/admin/models — operator surface for promoting / canary-rolling
// trained model_versions. Lists every model with its coefficient
// summary, rollout %, training sample count. Each row has a slider
// to set rollout_pct, a "Promote to 100%" shortcut, and the active
// indicator.
//
// Gated to FRUGAVO_ADMIN_USER_IDS env var. Non-admin → /app redirect.

export const dynamic = "force-dynamic";

export default async function ModelsAdminPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const allow = (process.env.FRUGAVO_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allow.includes(user.id)) redirect("/app");
  if (!supabaseAdmin) redirect("/app");

  const { data } = await supabaseAdmin
    .from("model_versions")
    .select(
      "id, version_string, coefficients, calibration, training_samples, is_active, rollout_pct, promoted_at, created_at"
    )
    .order("created_at", { ascending: false });

  const models = (data ?? []) as Array<{
    id: string;
    version_string: string;
    coefficients: Record<string, number>;
    calibration: { a: number; b: number } | null;
    training_samples: number;
    is_active: boolean;
    rollout_pct: number;
    promoted_at: string | null;
    created_at: string;
  }>;

  return (
    <section className="container-page py-8 md:py-12 max-w-[1100px]">
      <span className="text-[13px] font-medium text-brand">Admin</span>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Scoring models
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-body">
        Each row is a fitted logistic. Set rollout_pct to roll the
        model to a slice of users (deterministic hash on user_id).
        100% = global default.
      </p>
      <div className="mt-8">
        <AdminModelsTable models={models} />
      </div>
    </section>
  );
}
