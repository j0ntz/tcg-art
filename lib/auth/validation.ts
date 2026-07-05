// Shared by the client forms (inline field errors) and the server actions
// (authoritative re-check). Pure module: safe to import from either side.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export const validateEmail = (email: string): string | null =>
  EMAIL_RE.test(email.trim()) ? null : "Enter a valid email address.";

export const validatePassword = (password: string): string | null =>
  password.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
