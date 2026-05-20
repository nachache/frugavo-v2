import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign in · Frugavo",
  description: "Sign in to your Frugavo account.",
};

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-canvas">
      <SignIn
        path="/sign-in"
        signUpUrl="/sign-up"
        // Redirect target after signin: the app dashboard. New users without
        // a connected bank land on /app/connect; returning users with a
        // bank land on /app. The redirect logic happens server-side inside
        // /app/page.tsx so it stays decoupled from Clerk's flow.
        fallbackRedirectUrl="/app"
      />
    </main>
  );
}
