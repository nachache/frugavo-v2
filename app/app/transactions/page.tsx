import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { RescanButton } from "@/components/app/rescan-button";
import { BackPill } from "@/components/app/back-pill";

// /app/transactions — raw transactions view.
//
// Foundation page: lists every plaid_transactions row for the user,
// sorted newest first. Shows date, merchant, amount, account, and
// pending flag. Useful both as a "yes Frugavo really has my data"
// trust signal and as scaffolding for future features (filtering,
// search, tag-by-subscription, export).

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type Search = { page?: string; q?: string; bank?: string };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!supabaseAdmin) redirect("/app");

  const page = Math.max(0, Number(searchParams?.page ?? 0) || 0);
  const q = (searchParams?.q ?? "").trim();
  const bankFilter = (searchParams?.bank ?? "").trim();

  // Fetch the user's connected banks for the filter strip. Done in
  // parallel with the transactions query below.
  const [{ data: banks }, txnResult] = await Promise.all([
    supabaseAdmin
      .from("plaid_items")
      .select("id, institution_name, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    (async () => {
      let query = supabaseAdmin!
        .from("plaid_transactions")
        .select(
          "plaid_transaction_id, posted_date, amount_cents, currency, description, merchant_name, account_id, plaid_item_id, pending, pfc_primary",
          { count: "exact" }
        )
        .eq("user_id", user.id)
        .order("posted_date", { ascending: false })
        .order("plaid_transaction_id", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (bankFilter) {
        query = query.eq("plaid_item_id", bankFilter);
      }
      if (q.length > 0) {
        query = query.or(
          `description.ilike.%${q}%,merchant_name.ilike.%${q}%`
        );
      }
      return query;
    })(),
  ]);
  const { data, count } = txnResult;
  const bankList = (banks ?? []) as Array<{
    id: string;
    institution_name: string | null;
    status: string | null;
  }>;
  const bankNameById = new Map(
    bankList.map((b) => [b.id, b.institution_name ?? "Bank"])
  );
  const rows = (data ?? []) as Array<{
    plaid_transaction_id: string;
    posted_date: string;
    amount_cents: number;
    currency: string | null;
    description: string | null;
    merchant_name: string | null;
    account_id: string | null;
    plaid_item_id: string | null;
    pending: boolean | null;
    pfc_primary: string | null;
  }>;

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <section className="container-page py-8 md:py-12 max-w-[1100px]">
      <div className="mb-6 md:mb-8">
        <BackPill href="/app" label="Back to dashboard" />
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-brand">
            Transactions
          </span>
          <h1 className="mt-2 font-display text-[28px] md:text-[36px] font-bold tracking-[-0.02em] leading-[1.05] text-ink">
            Raw activity
          </h1>
          <p className="mt-2 text-[13.5px] md:text-[14.5px] leading-relaxed text-ink-body">
            Every transaction Frugavo has pulled from your connected accounts.{" "}
            {total.toLocaleString("en-US")} total.
          </p>
        </div>
        {/* In-place re-sync — same logo-spin treatment as the dashboard
            QuickActions, no navigation, refreshes the server tree on
            settle so the list reflects the new pull. */}
        <div className="shrink-0">
          <RescanButton variant="compact" label="Re-sync now" />
        </div>
      </div>

      {/* Bank filter strip — only renders when there's more than
          one connected bank. Each pill is a Link with the right
          query string so the filter is URL-driven (shareable,
          back-button-safe). */}
      {bankList.length > 1 ? (
        <div className="mt-6 flex flex-wrap items-center gap-1.5">
          <FilterPill
            href={qsBuilder({ q, bank: "" })}
            active={!bankFilter}
            label="All banks"
          />
          {bankList.map((b) => (
            <FilterPill
              key={b.id}
              href={qsBuilder({ q, bank: b.id })}
              active={bankFilter === b.id}
              label={b.institution_name ?? "Bank"}
            />
          ))}
        </div>
      ) : null}

      <form className="mt-4 md:mt-6" action="/app/transactions" method="get">
        {bankFilter ? (
          <input type="hidden" name="bank" value={bankFilter} />
        ) : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search description or merchant…"
          className="w-full md:max-w-[420px] h-10 px-4 rounded-full border border-hairline bg-surface text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </form>

      <div className="mt-6 rounded-2xl border border-hairline bg-surface overflow-hidden">
        <div className="hidden md:grid grid-cols-[110px_1fr_120px_110px_100px_100px] gap-3 px-4 py-3 border-b border-hairline/60 text-[11px] uppercase tracking-[0.08em] font-medium text-ink-muted">
          <span>Date</span>
          <span>Merchant</span>
          <span className="text-right">Amount</span>
          <span>Bank</span>
          <span>Category</span>
          <span className="text-right">Status</span>
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-ink-muted">
            {q
              ? `No transactions match "${q}".`
              : "No transactions yet. Connect a bank or wait for Plaid to deliver."}
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {rows.map((r) => {
              const merchant =
                r.merchant_name || r.description || "Unknown merchant";
              const date = new Date(r.posted_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "2-digit",
              });
              const isOutflow = r.amount_cents < 0;
              const amount = formatAmount(r.amount_cents, r.currency);
              return (
                <li
                  key={r.plaid_transaction_id}
                  className="grid grid-cols-[110px_1fr_120px] md:grid-cols-[110px_1fr_120px_110px_100px_100px] gap-3 px-4 py-3 items-center text-[13.5px]"
                >
                  <span className="text-ink-muted tabular-nums">{date}</span>
                  <span className="text-ink truncate" title={merchant}>
                    {merchant}
                  </span>
                  <span
                    className={
                      "text-right tabular-nums font-medium " +
                      (isOutflow ? "text-ink" : "text-brand")
                    }
                  >
                    {amount}
                  </span>
                  <span className="hidden md:inline text-[12px] text-ink-body truncate" title={bankNameById.get(r.plaid_item_id ?? "") ?? "—"}>
                    {bankNameById.get(r.plaid_item_id ?? "") ?? "—"}
                  </span>
                  <span className="hidden md:inline text-[12px] text-ink-muted truncate">
                    {r.pfc_primary || "—"}
                  </span>
                  <span className="hidden md:inline text-right text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                    {r.pending ? "Pending" : "Posted"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between text-[12.5px] text-ink-muted">
          <span>
            Showing {start.toLocaleString("en-US")}–
            {end.toLocaleString("en-US")} of {total.toLocaleString("en-US")}
          </span>
          <div className="inline-flex items-center gap-1">
            {page > 0 ? (
              <Link
                href={qsBuilder({ q, bank: bankFilter, page: page - 1 })}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-hairline bg-surface px-3 hover:bg-ink/[0.04] transition"
              >
                ← Prev
              </Link>
            ) : null}
            {page < pageCount - 1 ? (
              <Link
                href={qsBuilder({ q, bank: bankFilter, page: page + 1 })}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-hairline bg-surface px-3 hover:bg-ink/[0.04] transition"
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FilterPill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium border transition " +
        (active
          ? "bg-ink text-canvas border-ink"
          : "bg-surface text-ink border-hairline hover:bg-ink/[0.04]")
      }
    >
      {label}
    </Link>
  );
}

function qsBuilder(args: { q?: string; bank?: string; page?: number }): string {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.bank) params.set("bank", args.bank);
  if (args.page && args.page > 0) params.set("page", String(args.page));
  const qs = params.toString();
  return qs ? `/app/transactions?${qs}` : "/app/transactions";
}

function formatAmount(cents: number, currency: string | null): string {
  const abs = Math.abs(cents) / 100;
  const sym = currency === "USD" || currency === "CAD" || !currency ? "$" : "";
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `${sym}${formatted}` : `+${sym}${formatted}`;
}
