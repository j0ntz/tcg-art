import Link from "next/link";
import { buttonVariants } from "./components/ui/Button";

// Site-wide 404, also reached via notFound() from the card detail page when an
// id is unknown to the card API.
const NotFound: React.FC = () => (
  <main className="mx-auto flex w-full max-w-content flex-1 flex-col items-start justify-center gap-6 px-gutter py-24">
    <p className="tnum text-sm text-foreground-subtle">404</p>
    <h1 className="font-display text-title font-semibold tracking-tight text-foreground">
      This card isn&apos;t in the collection.
    </h1>
    <p className="max-w-md text-lead text-foreground-muted">
      The page you&apos;re after doesn&apos;t exist or has moved. The art you remember is still
      findable.
    </p>
    <div className="flex gap-3">
      <Link href="/search" className={buttonVariants({ variant: "primary", size: "md" })}>
        Search the art
      </Link>
      <Link href="/" className={buttonVariants({ variant: "secondary", size: "md" })}>
        Go home
      </Link>
    </div>
  </main>
);

export default NotFound;
