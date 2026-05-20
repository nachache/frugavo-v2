"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

// Article typography. Tuned for editorial reading rhythm rather than
// information-density. Body size 18.5px, line-height 1.85, generous
// paragraph spacing, restrained blockquote treatment.

export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="prose-frugavo">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1
              className="font-editorial text-[30px] md:text-[36px] font-semibold tracking-[-0.02em] leading-[1.15] text-ink mt-14 mb-5"
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="font-editorial text-[24px] md:text-[28px] font-semibold tracking-[-0.015em] leading-[1.2] text-ink mt-14 mb-4"
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="font-editorial text-[20px] md:text-[22px] font-semibold tracking-[-0.01em] leading-[1.25] text-ink mt-10 mb-3"
              {...props}
            />
          ),
          p: (props) => (
            <p
              className="font-editorialBody text-[18px] md:text-[19px] leading-[1.85] text-ink-body mt-6"
              {...props}
            />
          ),
          a: ({ href = "", children, ...rest }) => {
            const isInternal = href.startsWith("/");
            if (isInternal) {
              return (
                <Link
                  href={href}
                  className="text-brand underline decoration-brand/30 underline-offset-[5px] hover:decoration-brand transition"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline decoration-brand/30 underline-offset-[5px] hover:decoration-brand transition"
                {...rest}
              >
                {children}
              </a>
            );
          },
          strong: (props) => (
            <strong className="font-semibold text-ink" {...props} />
          ),
          ul: (props) => (
            <ul
              className="font-editorialBody mt-6 ml-5 list-disc text-[18px] md:text-[19px] leading-[1.85] text-ink-body space-y-3"
              {...props}
            />
          ),
          ol: (props) => (
            <ol
              className="font-editorialBody mt-6 ml-5 list-decimal text-[18px] md:text-[19px] leading-[1.85] text-ink-body space-y-3"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="font-editorialBody mt-8 mb-2 border-l-[3px] border-brand/40 pl-5 py-1 text-[18px] md:text-[19px] leading-[1.7] text-ink-body italic"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className="rounded bg-ink/[0.06] px-1.5 py-0.5 text-[0.9em] text-ink"
              {...props}
            />
          ),
          hr: () => <hr className="my-14 border-hairline" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
