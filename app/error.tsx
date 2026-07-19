"use client";

import { useEffect } from "react";
import Button from "./components/ui/Button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Route-level error boundary: a designed failure state with a real retry,
// instead of a blank screen. The error is logged for debugging; users get
// plain language.
const RouteError: React.FC<ErrorProps> = ({ error, reset }) => {
  useEffect(() => {
    console.error("route error boundary", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col items-start justify-center gap-6 px-gutter py-24">
      <h1 className="font-display text-title font-semibold tracking-tight text-foreground">
        Something went wrong.
      </h1>
      <p className="max-w-md text-lead text-foreground-muted">
        An unexpected error interrupted this page. Your saves, decks, and account are unaffected.
      </p>
      <Button type="button" variant="primary" size="md" onClick={reset}>
        Try again
      </Button>
    </main>
  );
};

export default RouteError;
