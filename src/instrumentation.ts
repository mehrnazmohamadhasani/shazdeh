import type { Instrumentation } from "next";

/*
 * Errors Next.js catches itself (page rendering, uncaught route errors)
 * go to the same reporter as the API's own error handling.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/lib/report-error");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  await reportError(err, {
    where: `${context.routeType} ${context.routePath}`,
    method: request.method,
    path: request.path,
    digest,
  });
};
