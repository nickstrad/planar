import { auth } from "@/lib/auth";
import { ERRORS } from "@/lib/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { userId: "user_123" };
});
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    throw new TRPCError(ERRORS.UNAUTHORIZED);
  }
  return next({ ctx: { ...ctx, auth: session } });
});

// Helper to check if email is admin
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const adminsEnv = process.env.ADMINS;
  if (!adminsEnv) return false;

  const adminEmails = adminsEnv.split(',').map(e => e.trim().toLowerCase());
  return adminEmails.includes(email.toLowerCase());
}

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const userEmail = ctx.auth?.user?.email;

  if (!isAdminEmail(userEmail)) {
    throw new TRPCError(ERRORS.FORBIDDEN);
  }

  return next({ ctx: { ...ctx, isAdmin: true } });
});
