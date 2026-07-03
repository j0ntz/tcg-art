import type { NextRequest } from "next/server";

import { handlers } from "@/lib/auth";
import { getAuthStatus } from "@/lib/auth/status";

// When auth is unconfigured (production deployment without AUTH_SECRET) the
// NextAuth handlers would throw MissingSecret; answer 503 instead so bare
// preview deployments degrade cleanly.
const guard =
  (handler: (req: NextRequest) => Promise<Response>) =>
  async (req: NextRequest): Promise<Response> => {
    if (!getAuthStatus().authEnabled) {
      return Response.json({ error: "Auth is not configured on this deployment." }, { status: 503 });
    }
    return handler(req);
  };

export const GET = guard(handlers.GET);
export const POST = guard(handlers.POST);
