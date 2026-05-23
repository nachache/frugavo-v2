import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { loadPreferences } from "@/lib/notifications/preferences";
import { NotificationSettings } from "@/components/app/notification-settings";

export default async function NotificationSettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const prefs = await loadPreferences(user.id);

  return (
    <section className="container-page py-8 md:py-12 max-w-[720px] space-y-6">
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
