import { ClerkProvider } from "@clerk/nextjs";

// Wraps Clerk's <SignIn> component with ClerkProvider. ClerkProvider
// was moved out of the root layout to keep the 252 KB Clerk bundle
// off the marketing pages — see app/layout.tsx for the rationale.
// Sign-in needs it because Clerk's UI components depend on the
// context provider being in the tree.

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#047857",
          colorText: "#0A0A0A",
          colorBackground: "#FAF8F4",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
