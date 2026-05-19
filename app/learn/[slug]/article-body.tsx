"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

// Article typography: Fraunces (serif display) for headings, Newsreader for
// body. Differentiates editorial content from the marketing site and improves
// long-form readability. Internal /learn links are routed through Next's
// <Link> for instant navigation between articles.

export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="prose-frugavo">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1
              className="font-editorial text-[30px] md:text-[36px] font-semibold tracking-[-0.02em] leading-tight text-ink mt-10 mb-4"
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="font-editorial text-[24px] md:text-[28px] font-semibold tracking-[-0.015em] leading-tight text-ink mt-10 mb-3"
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="font-editorial text-[20px] md:text-[22px] font-semibold tracking-[-0.01em] text-ink mt-8 mb-2"
              {...props}
            />
          ),
          p: (props) => (
            <p
              className="font-editorialBody text-[17.5px] leading-[1.7] text-ink-body mt-5"
              {...props}
            />
          ),
          a: ({ href = "", children, ...rest }) => {
            const isInternal = href.startsWith("/");
            if (isInternal) {
              return (
                <Link
                  href={href}
                  className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand transition"
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
                className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand transition"
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
              className="font-editorialBody mt-4 ml-5 list-disc text-[17.5px] leading-[1.7] text-ink-body space-y-2"
              {...props}
            />
          ),
          ol: (props) => (
            <ol
              className="font-editorialBody mt-4 ml-5 list-decimal text-[17.5px] leading-[1.7] text-ink-body space-y-2"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="font-editorialBody mt-5 border-l-2 border-brand pl-4 italic text-ink-body"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className="rounded bg-ink/[0.06] px-1.5 py-0.5 text-[0.9em] text-ink"
              {...props}
            />
          ),
          hr: () => <hr className="my-10 border-hairline" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
