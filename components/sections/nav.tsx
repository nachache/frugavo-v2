"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shared/wordmark";
import { nav } from "@/lib/content";
import { cn } from "@/lib/utils";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 ease-out",
        scrolled
          ? "bg-canvas/95 backdrop-blur-md shadow-[0_1px_0_rgba(10,10,10,0.06)]"
          : "bg-canvas/70"
      )}
    >
      <div className="container-page flex h-[68px] items-center justify-between">
        <Wordmark />

        <nav className="hidden md:flex items-center gap-1">
          {nav.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-[14px] text-ink-body hover:text-ink hover:bg-ink/[0.04] transition"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <a
            href={nav.signIn.href}
            className="rounded-full px-4 py-2 text-[14px] text-ink-body hover:text-ink hover:bg-ink/[0.04] transition"
          >
            {nav.signIn.label}
          </a>
          <Button asChild size="sm" className="h-10 px-5">
            <a href={nav.cta.href}>{nav.cta.label}</a>
          </Button>
        </div>

        <button
          className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-ink/[0.04] transition"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden border-t border-hairline bg-canvas/95 backdrop-blur-xl"
          >
            <div className="container-page py-4 flex flex-col gap-1">
              {nav.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-[15px] text-ink-body hover:bg-ink/[0.04]"
                >
                  {l.label}
                </a>
              ))}
              <a
                href={nav.signIn.href}
                className="rounded-xl px-4 py-3 text-[15px] text-ink-body hover:bg-ink/[0.04]"
              >
                {nav.signIn.label}
              </a>
              <Button
                size="md"
                className="mt-2 w-full"
                onClick={() => {
                  setOpen(false);
                  document
                    .querySelector(nav.cta.href)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {nav.cta.label}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
