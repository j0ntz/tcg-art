"use client";

import { useState } from "react";
import { logInWithPassword, signUpWithPassword } from "@/lib/auth/actions";
import { validateEmail, validatePassword } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";
import Button from "../ui/Button";

// Email + password form shared by /login and /signup. Validation runs inline
// for fast feedback, then the server action re-checks and either redirects to
// /account (success) or returns an error we surface in the banner. When the
// deployment has no database/secret configured, the form renders disabled
// with a pointer to the runbook.

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
}

interface Props {
  mode: "login" | "signup";
  enabled: boolean;
}

const fieldClass = (hasError: boolean): string =>
  cn(
    "w-full rounded-field border bg-surface px-4 py-3 text-foreground outline-none focus:border-foreground disabled:cursor-not-allowed disabled:opacity-50",
    hasError ? "border-danger-border" : "border-border-strong",
  );

const CredentialsForm: React.FC<Props> = ({ mode, enabled }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignup = mode === "signup";
  const submitLabel = isSignup ? "Create Account" : "Log In";

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {};
    const emailError = validateEmail(email);
    if (emailError != null) nextErrors.email = emailError;
    if (isSignup) {
      const passwordError = validatePassword(password);
      if (passwordError != null) nextErrors.password = passwordError;
      if (confirm !== password) nextErrors.confirm = "Passwords do not match.";
    } else if (password === "") {
      nextErrors.password = "Enter your password.";
    }
    return nextErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length > 0) return;
    setPending(true);
    try {
      const action = isSignup ? signUpWithPassword : logInWithPassword;
      const result = await action({ email, password });
      // On success the action redirects (result is then undefined) and
      // navigation is already in flight; keep the pending state until then.
      if (result?.error != null) {
        setServerError(result.error);
        setPending(false);
      }
    } catch (e: unknown) {
      console.error(`${mode} action failed`, e);
      setServerError("Something went wrong. Try again.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {!enabled ? (
        <p className="rounded-field bg-surface-hover px-4 py-3 text-sm text-foreground-subtle" role="status">
          Email sign-in is not configured on this deployment yet. See{" "}
          <span className="font-mono">docs/auth-setup.md</span> for setup.
        </p>
      ) : null}

      {serverError != null ? (
        <p
          className="rounded-field border border-danger-border px-4 py-3 text-sm text-danger"
          role="alert"
          data-testid="auth-server-error"
        >
          {serverError}
        </p>
      ) : null}

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
          disabled={!enabled}
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
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={isSignup ? "At least 8 characters" : "Your password"}
          className={fieldClass(errors.password != null)}
          aria-invalid={errors.password != null}
          disabled={!enabled}
        />
        {errors.password != null ? (
          <p className="text-sm text-danger" role="alert">
            {errors.password}
          </p>
        ) : null}
      </div>

      {isSignup ? (
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
            disabled={!enabled}
          />
          {errors.confirm != null ? (
            <p className="text-sm text-danger" role="alert">
              {errors.confirm}
            </p>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="md" className="mt-1 disabled:cursor-not-allowed disabled:opacity-50" disabled={!enabled || pending}>
        {pending ? (isSignup ? "Creating account..." : "Logging in...") : submitLabel}
      </Button>
    </form>
  );
};

export default CredentialsForm;
