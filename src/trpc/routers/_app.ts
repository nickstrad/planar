import { createTRPCRouter } from "../init";
import { entitiesRouter } from "@/features/entity/server/router";
export const appRouter = createTRPCRouter({
  entities: entitiesRouter,
});

export type AppRouter = typeof appRouter;
