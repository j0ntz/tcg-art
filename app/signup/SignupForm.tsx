"use client";

import Link from "next/link";
import { useState } from "react";

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
  `w-full rounded-lg border bg-white px-4 py-3 text-zinc-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 ${
    hasError ? "border-red-500" : "border-zinc-300"
  }`;

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
        className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm"
        data-testid="signup-success"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-2xl text-white">
          ✓
        </div>
        <h2 className="text-xl font-semibold text-zinc-900">Check your email</h2>
        <p className="text-zinc-600">
          We sent a confirmation link to <span className="font-medium text-zinc-900">{email}</span>.
          Click it to finish setting up your TCG-Art account.
        </p>
        <Link
          href="/search"
          className="mt-2 font-medium text-violet-700 underline underline-offset-4 hover:text-violet-900"
        >
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
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
          <p className="text-sm text-red-600" role="alert">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
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
          <p className="text-sm text-red-600" role="alert">
            {errors.password}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-medium text-zinc-700">
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
          <p className="text-sm text-red-600" role="alert">
            {errors.confirm}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        className="mt-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        Create Account
      </button>

      <p className="text-center text-sm text-zinc-500">
        No real account is created. This is a UI demo with client-side validation only.
      </p>
    </form>
  );
};

export default SignupForm;
