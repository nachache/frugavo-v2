import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

// /app/transactions — raw transactions view.
//
// Foundation page: lists every plaid_transactions row for the user,
// sorted newest first. Shows date, merchant, amount, account, and
// pending flag. Useful both as a "yes Frugavo really has my data"
// trust signal and as scaffolding for future features (filtering,
// search, tag-by-subscription, export).

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type Search = { page?: string; q?: string };

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

  let query = supabaseAdmin
    .from("plaid_transactions")
    .select(
      "plaid_transaction_id, posted_date, amount_cents, currency, description, merchant_name, account_id, pending, pfc_primary",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("posted_date", { ascending: false })
    .order("plaid_transaction_id", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (q.length > 0) {
    // PostgREST ilike — case-insensitive substring on description OR
    // merchant_name. Two filters joined with OR.
    query = query.or(`description.ilike.%${q}%,merchant_name.ilike.%${q}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as Array<{
    plaid_transaction_id: string;
    posted_date: string;
    amount_cents: number;
    currency: string | null;
    description: string | null;
    merchant_name: string | null;
    account_id: string | null;
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
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to dashboard
        </Link>
      </div>

      <span className="text-[13px] font-medium text-brand">Transactions</span>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Raw activity
      </h1>
      <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
        Every transaction Frugavo has pulled from your connected accounts.{" "}
        {total.toLocaleString("en-US")} total.
      </p>

      <form className="mt-6 md:mt-8" action="/app/transactions" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search description or merchant…"
          className="w-full md:max-w-[420px] h-10 px-4 rounded-full border border-hairline bg-surface text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </form>

      <div className="mt-6 rounded-2xl border border-hairline bg-surface overflow-hidden">
        <div className="hidden md:grid grid-cols-[110px_1fr_120px_120px_100px] gap-3 px-4 py-3 border-b border-hairline/60 text-[11px] uppercase tracking-[0.08em] font-medium text-ink-muted">
          <span>Date</span>
          <span>Merchant</span>
          <span className="text-right">Amount</span>
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
                  className="grid grid-cols-[110px_1fr_120px] md:grid-cols-[110px_1fr_120px_120px_100px] gap-3 px-4 py-3 items-center text-[13.5px]"
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
                href={`/app/transactions?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-hairline bg-surface px-3 hover:bg-ink/[0.04] transition"
              >
                ← Prev
              </Link>
            ) : null}
            {page < pageCount - 1 ? (
              <Link
                href={`/app/transactions?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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

function formatAmount(cents: number, currency: string | null): string {
  const abs = Math.abs(cents) / 100;
  const sym = currency === "USD" || currency === "CAD" || !currency ? "$" : "";
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `${sym}${formatted}` : `+${sym}${formatted}`;
}
