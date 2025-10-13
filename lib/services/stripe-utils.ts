function computeBaseUrl(): string | undefined {
  return (
    process.env.STRIPE_PLATFORM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  );
}

export function resolveStripePlatformBaseUrl(): string {
  const baseUrl = computeBaseUrl();

  if (!baseUrl) {
    throw new Error(
      "Set STRIPE_PLATFORM_BASE_URL (or NEXT_PUBLIC_APP_URL) so Stripe knows where to send users after onboarding or checkout."
    );
  }

  return baseUrl.replace(/\/$/, "");
}

export function ensureAbsoluteStripeUrl(urlOrPath: string, baseUrl?: string): string {
  if (!urlOrPath) {
    throw new Error("A valid URL or path is required.");
  }

  const resolvedBaseUrl = baseUrl ?? resolveStripePlatformBaseUrl();

  try {
    const parsed = new URL(urlOrPath);
    return parsed.toString();
  } catch {
    const normalized = urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
    return `${resolvedBaseUrl}${normalized}`;
  }
}
