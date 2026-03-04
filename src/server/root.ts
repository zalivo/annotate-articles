import { router } from "./trpc";
import { articlesRouter } from "./routers/articles";
import { annotationsRouter } from "./routers/annotations";
import { sharedLinksRouter } from "./routers/sharedLinks";

export const appRouter = router({
  articles: articlesRouter,
  annotations: annotationsRouter,
  sharedLinks: sharedLinksRouter,
});

export type AppRouter = typeof appRouter;
