import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { loadPreferences } from "@/lib/notifications/preferences";
import { NotificationSettings } from "@/components/app/notification-settings";

export default async function NotificationSettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const prefs = await loadPreferences(user.id);

  return (
    <section className="container-page py-8 md:py-12 max-w-[720px] space-y-6">
      {/* Back to dashboard — sub-page navigation. The app shell
          doesn't include a global nav so deep pages need their own
          escape hatch. */}
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to dashboard
      </Link>
      <div>
        <span className="text-[13px] font-medium text-brand">Settings</span>
        <h1 className="mt-2 font-display text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          Notifications
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
          Choose what Frugavo is allowed to email you about, and how often.
          Urgent alerts (trial conversions, big price hikes, unusual charges)
          arrive as they happen. Everything else is bundled into a digest at
          the frequency you pick — daily, weekly, monthly, or off entirely.
        </p>
      </div>

      <NotificationSettings initial={prefs} />
    </section>
  );
}
