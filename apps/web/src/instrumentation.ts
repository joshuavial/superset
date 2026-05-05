type CaptureRequestError = typeof import("@sentry/nextjs").captureRequestError;

function shouldSkipSentryRegistration(): boolean {
	return Boolean(
		process.env.NODE_ENV === "development" &&
			!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
	);
}

export async function register() {
	if (shouldSkipSentryRegistration()) {
		return;
	}

	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("../sentry.server.config");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("../sentry.edge.config");
	}
}

export const onRequestError: CaptureRequestError = (...args) => {
	if (shouldSkipSentryRegistration()) {
		return;
	}

	void import("@sentry/nextjs").then((Sentry) => {
		Sentry.captureRequestError(...args);
	});
};
