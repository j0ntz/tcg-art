import { logInWithGoogle } from "@/lib/auth/actions";
import Button from "../ui/Button";

// Server component: the enabled button posts to the logInWithGoogle server
// action, which redirects to Google's consent screen. When the deployment has
// no Google OAuth client configured it renders disabled with a hint, so the
// page still makes sense before the human runbook steps are done.

interface Props {
  enabled: boolean;
}

const GoogleGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.29 6.63l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
    />
  </svg>
);

const GoogleButton: React.FC<Props> = ({ enabled }) => {
  if (!enabled) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled
          className="gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GoogleGlyph /> Continue with Google
        </Button>
        <p className="text-center text-sm text-foreground-subtle" role="status">
          Google sign-in is not configured on this deployment yet. See{" "}
          <span className="font-mono">docs/auth-setup.md</span> for setup.
        </p>
      </div>
    );
  }

  return (
    <form action={logInWithGoogle} className="flex flex-col">
      <Button type="submit" variant="secondary" size="md" className="gap-2">
        <GoogleGlyph /> Continue with Google
      </Button>
    </form>
  );
};

export default GoogleButton;
