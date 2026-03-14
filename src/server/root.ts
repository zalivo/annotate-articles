import { router } from "./trpc";
import { articlesRouter } from "./routers/articles";
import { annotationsRouter } from "./routers/annotations";
import { sharedLinksRouter } from "./routers/sharedLinks";
import { stacksRouter } from "./routers/stacks";

export const appRouter = router({
  articles: articlesRouter,
  annotations: annotationsRouter,
  sharedLinks: sharedLinksRouter,
  stacks: stacksRouter,
});

export type AppRouter = typeof appRouter;
