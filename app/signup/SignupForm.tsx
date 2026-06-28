"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "../components/ui/Button";
import { cardVariants } from "../components/ui/Card";
import { cn } from "@/lib/utils";

// Client-only signup UI. No backend, no auth, no real account is created:
// on a valid submit we just flip to a "check your email" success state.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
}

const validate = (email: string, password: string, confirm: string): FieldErrors => {
  const errors: FieldErrors = {};
  if (!EMAIL_RE.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (confirm !== password) {
    errors.confirm = "Passwords do not match.";
  }
  return errors;
};

const fieldClass = (hasError: boolean): string =>
  cn(
    "w-full rounded-field border bg-surface px-4 py-3 text-foreground outline-none focus:border-foreground",
    hasError ? "border-danger-border" : "border-border-strong",
  );

const SignupForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const nextErrors = validate(email, password, confirm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div
        className={cn(cardVariants(), "flex flex-col items-center gap-4 p-8 text-center")}
        data-testid="signup-success"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-success-subtle text-2xl">
          ✓
        </div>
        <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
        <p className="text-foreground-subtle">
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
          Click it to finish setting up your TCG-Art account.
        </p>
        <Link href="/search" className="mt-2 font-medium text-foreground underline underline-offset-4">
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn(cardVariants(), "flex flex-col gap-5 p-8")}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground-secondary">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={fieldClass(errors.email != null)}
          aria-invalid={errors.email != null}
        />
        {errors.email != null ? (
          <p className="text-sm text-danger" role="alert">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-foreground-secondary">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={fieldClass(errors.password != null)}
          aria-invalid={errors.password != null}
        />
        {errors.password != null ? (
          <p className="text-sm text-danger" role="alert">
            {errors.password}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-medium text-foreground-secondary">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          className={fieldClass(errors.confirm != null)}
          aria-invalid={errors.confirm != null}
        />
        {errors.confirm != null ? (
          <p className="text-sm text-danger" role="alert">
            {errors.confirm}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="primary" size="md" className="mt-1">
        Create Account
      </Button>

      <p className="text-center text-sm text-foreground-subtle">
        No real account is created. This is a UI demo with client-side validation only.
      </p>
    </form>
  );
};

export default SignupForm;
