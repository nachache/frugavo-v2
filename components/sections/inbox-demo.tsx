"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import {
  Check,
  Inbox as InboxIcon,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Star,
} from "lucide-react";
import { inboxSubs, type InboxSub } from "@/lib/content";
import { Monogram } from "@/components/ui/monogram";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/shared/confetti";
import { useToast } from "@/components/shared/toast";
import { cn, formatCurrency } from "@/lib/utils";

type CardState = "active" | "cancelling" | "cancelled";

export function InboxDemo() {
  const { push } = useToast();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  // Per-card state (active / cancelling / cancelled)
  const [cards, setCards] = useState<Record<string, CardState>>(
    () => Object.fromEntries(inboxSubs.map((s) => [s.id, "active"])) as Record<string, CardState>
  );

  // Which inbox emails have had their "$/mo · Recurring" badge revealed yet.
  // The sweep overlay drives this so the badges appear in cadence.
  const [scanned, setScanned] = useState<Set<string>>(new Set());

  const [modalSub, setModalSub] = useState<InboxSub | null>(null);

  // Trigger the inbox scan once when section is in view
  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setScanned(new Set(inboxSubs.map((s) => s.id)));
      return;
    }
    // Sweep takes 2500ms, so reveal each email at staggered offsets.
    const timers = inboxSubs.map((s, i) =>
      window.setTimeout(() => {
        setScanned((cur) => new Set(cur).add(s.id));
      }, 250 + i * 240)
    );
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced]);

  const totalSaved = inboxSubs.reduce(
    (acc, s) => (cards[s.id] === "cancelled" ? acc + s.amount : acc),
    0
  );

  const onCancel = (sub: InboxSub) => {
    if (cards[sub.id] === "cancelled") return;
    setModalSub(sub);
  };

  const onCancelComplete = (sub: InboxSub) => {
    setCards((c) => ({ ...c, [sub.id]: "cancelled" }));
    push({
      title: `${sub.brand} cancelled`,
      sub: `You'll save ${formatCurrency(sub.amount * 12)} this year`,
    });
  };

  const onReset = () => {
    setCards(Object.fromEntries(inboxSubs.map((s) => [s.id, "active"])) as Record<string, CardState>);
    setScanned(new Set());
    // re-trigger scan
    inboxSubs.forEach((s, i) =>
      window.setTimeout(() => {
        setScanned((cur) => new Set(cur).add(s.id));
      }, 250 + i * 240)
    );
  };

  return (
    <section
      id="demo"
      ref={ref}
      className="py-24 md:py-32 bg-canvas"
    >
      <div className="container-page">
        <div className="max-w-[720px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-brand">Live demo</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink-body">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Sample data · Pre-launch preview
            </span>
          </div>
          <h2 className="mt-2 text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
            See what your list will look like.
          </h2>
          <p className="mt-4 text-[18px] text-ink-body">
            A preview of the Frugavo dashboard once your bank is connected.
            Every recurring charge in one list, with a one-tap path to the
            provider’s real cancel page. The data and brands shown are samples
            — we’re launching soon.{" "}
            <a href="#cta" className="text-ink underline underline-offset-4 hover:text-brand transition">
              Join the waitlist
            </a>{" "}
            to be first.
          </p>
        </div>

        {/* sr-only skip button */}
        <button
          onClick={onReset}
          className="sr-only focus:not-sr-only focus:mt-4 focus:inline-flex rounded-full bg-ink px-3 py-1.5 text-sm text-white"
        >
          Skip animation and reset demo
        </button>

        <div className="mt-12 grid gap-6 lg:grid-cols-2 min-w-0">
          <div className="min-w-0">
            <Inbox scanned={scanned} inView={inView} />
          </div>
          <div className="min-w-0">
            <Dashboard
              cards={cards}
              totalSaved={totalSaved}
              onCancel={onCancel}
              onReset={onReset}
            />
          </div>
        </div>
      </div>

      <CancelModal
        sub={modalSub}
        onClose={() => setModalSub(null)}
        onComplete={onCancelComplete}
      />
    </section>
  );
}

// -- INBOX (left panel) ------------------------------------------------------

function Inbox({
  scanned,
  inView,
}: {
  scanned: Set<string>;
  inView: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white border border-hairline/60 shadow-soft">
      {/* gmail-ish header */}
      <div className="flex items-center gap-3 border-b border-hairline/60 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="relative ml-2 flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <div className="h-8 w-full rounded-lg bg-canvas/80 pl-9 pr-3 flex items-center text-[12.5px] text-ink-muted">
            in:inbox subscription
          </div>
        </div>
        <span className="text-[11px] font-medium text-ink-muted hidden sm:inline">
          1 of {inboxSubs.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr]">
        {/* sidebar — hidden on mobile to keep the email list full-width */}
        <aside className="border-r border-hairline/60 p-3 hidden sm:block">
          <SideItem icon={InboxIcon} label="Inbox" active />
          <SideItem icon={Star} label="Starred" />
          <SideItem icon={Send} label="Sent" />
        </aside>

        {/* email list with sweep overlay */}
        <div className="relative">
          <ul>
            {inboxSubs.map((s) => (
              <li
                key={s.id}
                className="group flex items-center gap-3 border-b border-hairline/40 px-4 py-3.5 last:border-b-0"
              >
                <BrandIcon
                  id={s.id}
                  size="sm"
                  fallback={<Monogram label={s.mono} color={s.color} size="sm" />}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-ink truncate">
                      {s.brand}
                    </span>
                    <span className="text-[11px] text-ink-muted truncate hidden md:inline">
                      {s.sender}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-ink-body truncate">
                    {s.subject}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AnimatePresence>
                    {scanned.has(s.id) && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[10.5px] font-medium text-brand tnum"
                      >
                        {formatCurrency(s.amount)}/mo · Recurring
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="text-[11px] text-ink-muted tnum hidden sm:inline">
                    {s.hint}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Frugavo scanning sweep */}
          {inView && !reduced && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="relative h-full w-full">
                <div
                  className="absolute inset-x-0 h-32 animate-sweep"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 0%, rgba(16,185,129,0.18) 50%, transparent 100%)",
                  }}
                />
              </div>
            </div>
          )}

          {/* tiny "Frugavo scanning..." pill */}
          {inView && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-white shadow-soft"
            >
              <Loader2 size={11} className="animate-spin" />
              Frugavo scanning…
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function SideItem({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof InboxIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px]",
        active
          ? "bg-brand-light text-brand font-medium"
          : "text-ink-body hover:bg-ink/[0.04]"
      )}
    >
      <Icon size={13} />
      {label}
    </div>
  );
}

// -- DASHBOARD (right panel) ------------------------------------------------

function Dashboard({
  cards,
  totalSaved,
  onCancel,
  onReset,
}: {
  cards: Record<string, CardState>;
  totalSaved: number;
  onCancel: (s: InboxSub) => void;
  onReset: () => void;
}) {
  const monthly = totalSaved;
  const annual = totalSaved * 12;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white border border-hairline/60 shadow-soft">
      {/* header */}
      <div className="flex items-center justify-between border-b border-hairline/60 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[12px] uppercase tracking-[0.14em] text-ink-muted">
              Frugavo dashboard
            </div>
            <span className="inline-flex items-center rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Demo
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <motion.span
              key={annual.toFixed(0)}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-[28px] font-display font-bold tracking-[-0.03em] text-ink tnum"
            >
              {formatCurrency(annual, false)}
            </motion.span>
            <span className="text-[13px] text-ink-muted">/yr saved</span>
            <span className="text-[12px] text-ink-muted tnum">
              · {formatCurrency(monthly)}/mo
            </span>
          </div>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition"
        >
          <RefreshCw size={12} />
          Reset demo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3">
        {inboxSubs.map((s) => {
          const state = cards[s.id];
          const cancelled = state === "cancelled";
          const annual = s.amount * 12;
          return (
            <article
              key={s.id}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl border bg-white p-3 transition duration-300 min-w-0",
                cancelled
                  ? "border-hairline/60 opacity-60"
                  : "border-hairline/60 shadow-soft hover:shadow-float hover:-translate-y-0.5"
              )}
            >
              <BrandIcon
                id={s.id}
                size="md"
                fallback={<Monogram label={s.mono} color={s.color} size="md" />}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium text-ink truncate">
                    {s.brand}
                  </span>
                  {cancelled && (
                    <Check size={11} className="text-brand shrink-0" strokeWidth={3} />
                  )}
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      "text-[17px] font-display font-semibold tracking-[-0.015em] tnum",
                      cancelled ? "text-ink-muted line-through" : "text-ink"
                    )}
                  >
                    {formatCurrency(s.amount)}
                  </span>
                  <span className="text-[11.5px] text-ink-muted tnum">
                    /mo · {formatCurrency(annual, false)}/yr
                  </span>
                </div>
              </div>

              {cancelled ? (
                <span
                  aria-label="Cancelled"
                  className="shrink-0 inline-flex h-8 items-center justify-center rounded-full bg-brand-light px-3 text-[11.5px] font-medium text-brand"
                >
                  Cancelled
                </span>
              ) : (
                <button
                  onClick={() => onCancel(s)}
                  className="shrink-0 inline-flex h-8 items-center justify-center rounded-full border border-hairline bg-white px-3.5 text-[12px] font-medium text-ink transition hover:border-accent hover:bg-accent hover:text-white"
                >
                  Cancel
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// -- CANCEL MODAL ------------------------------------------------------------
//
// V1 product is assist-only: deep link to provider + pre-filled email +
// self-report. The earlier modal showed a fake "AI agent logging in and
// cancelling" flow, which misrepresented the product. This version reflects
// what the user actually does: open the provider's cancel page in a new
// tab, send a pre-filled email if needed, mark as cancelled. Frugavo then
// watches the next billing cycle via Plaid to confirm the charge stops.

function CancelModal({
  sub,
  onClose,
  onComplete,
}: {
  sub: InboxSub | null;
  onClose: () => void;
  onComplete: (sub: InboxSub) => void;
}) {
  const [step, setStep] = useState<"choice" | "watching">("choice");
  const completedRef = useRef(false);

  useEffect(() => {
    if (!sub) {
      setStep("choice");
      completedRef.current = false;
    }
  }, [sub]);

  const handleMarkCancelled = () => {
    if (!sub) return;
    setStep("watching");
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete(sub);
    }
  };

  return (
    <AnimatePresence>
      {sub && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Cancel ${sub.brand}`}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[460px] rounded-3xl bg-white p-7 shadow-lift"
          >
            <div className="flex items-center gap-3">
              <BrandIcon
                id={sub.id}
                size="md"
                fallback={<Monogram label={sub.mono} color={sub.color} size="md" />}
              />
              <div>
                <div className="text-[15px] font-semibold text-ink">
                  {sub.brand}
                </div>
                <div className="text-[12.5px] text-ink-muted tnum">
                  {formatCurrency(sub.amount)}/mo · {formatCurrency(sub.amount * 12, false)}/yr
                </div>
              </div>
            </div>

            {step === "choice" && (
              <>
                <p className="mt-5 text-[14px] leading-relaxed text-ink-body">
                  Frugavo will open {sub.brand}&apos;s real cancel page in a new
                  tab and prepare an email you can send from your own inbox.
                  After you finish, mark it cancelled and we&apos;ll watch your
                  next billing cycle to confirm the charge stops.
                </p>

                <div className="mt-5 space-y-2">
                  <button
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-hairline bg-white px-4 h-11 text-[13.5px] font-medium text-ink hover:border-ink/30 hover:shadow-soft transition"
                    onClick={(e) => e.preventDefault()}
                  >
                    Open cancel page for {sub.brand} →
                  </button>
                  <button
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-hairline bg-white px-4 h-11 text-[13.5px] font-medium text-ink hover:border-ink/30 hover:shadow-soft transition"
                    onClick={(e) => e.preventDefault()}
                  >
                    Copy cancellation email
                  </button>
                </div>

                <button
                  onClick={handleMarkCancelled}
                  className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-ink h-11 px-5 text-[14px] font-medium text-white hover:bg-ink/85 transition"
                >
                  <Check size={14} strokeWidth={2.5} />
                  Mark as cancelled
                </button>
              </>
            )}

            {step === "watching" && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative mt-5 rounded-2xl bg-brand-light p-5 text-center"
              >
                <div className="relative inline-block">
                  <Confetti />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 320,
                      damping: 18,
                      delay: 0.05,
                    }}
                    className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white"
                  >
                    <Check size={22} strokeWidth={3} />
                  </motion.div>
                </div>
                <div className="mt-3 text-[15px] font-semibold text-brand">
                  Marked as cancelled
                </div>
                <div className="text-[13px] text-emerald-800/80 mt-1 max-w-[320px] mx-auto leading-relaxed">
                  We&apos;ll watch your next billing cycle from {sub.brand}.
                  If they charge you again, we&apos;ll email you so you can
                  follow up.
                </div>
                <div className="text-[12px] text-emerald-800/70 mt-2 tnum">
                  Estimated yearly saving: {formatCurrency(sub.amount * 12)}
                </div>
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="dark"
                    onClick={onClose}
                    className="h-9"
                  >
                    Done
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
