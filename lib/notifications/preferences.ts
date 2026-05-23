// Notification preferences — read / write / merge with defaults.

import { supabaseAdmin } from "@/lib/supabase";
import {
  DEFAULT_PREFS,
  type NotificationPreferences,
} from "./types";

export async function loadPreferences(
  userId: string
): Promise<NotificationPreferences> {
  if (!supabaseAdmin) {
    return { user_id: userId, ...DEFAULT_PREFS };
  }
  const { data } = await supabaseAdmin
    .from("notification_preferences")
    .select(
      "user_id, email_enabled, digest_enabled, urgent_immediate_enabled, enabled_types, quiet_hours_local, global_unsubscribed_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return { user_id: userId, ...DEFAULT_PREFS };
  }

  return {
    user_id: data.user_id,
    email_enabled: data.email_enabled ?? DEFAULT_PREFS.email_enabled,
    digest_enabled: data.digest_enabled ?? DEFAULT_PREFS.digest_enabled,
    urgent_immediate_enabled:
      data.urgent_immediate_enabled ?? DEFAULT_PREFS.urgent_immediate_enabled,
    enabled_types: {
      ...DEFAULT_PREFS.enabled_types,
      ...(data.enabled_types ?? {}),
    },
    quiet_hours_local: data.quiet_hours_local ?? null,
    global_unsubscribed_at: data.global_unsubscribed_at ?? null,
  };
}

export async function savePreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, "user_id">>
): Promise<NotificationPreferences> {
  if (!supabaseAdmin) {
    return { user_id: userId, ...DEFAULT_PREFS, ...patch };
  }
  const current = await loadPreferences(userId);
  const merged: NotificationPreferences = {
    ...current,
    ...patch,
    enabled_types: {
      ...current.enabled_types,
      ...(patch.enabled_types ?? {}),
    },
  };
  await supabaseAdmin
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        email_enabled: merged.email_enabled,
        digest_enabled: merged.digest_enabled,
        urgent_immediate_enabled: merged.urgent_immediate_enabled,
        enabled_types: merged.enabled_types,
        quiet_hours_local: merged.quiet_hours_local,
        global_unsubscribed_at: merged.global_unsubscribed_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  return merged;
}

// True if the user should receive *any* email at all.
export function emailAllowed(p: NotificationPreferences): boolean {
  if (p.global_unsubscribed_at) return false;
  if (!p.email_enabled) return false;
  return true;
}

// True if this specific alert type is enabled.
export function typeAllowed(
  p: NotificationPreferences,
  alertType: string
): boolean {
  return p.enabled_types[alertType] !== false;
}
