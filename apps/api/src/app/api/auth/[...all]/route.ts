function shouldSkipAuthHandlers(): boolean {
	return Boolean(process.env.SKIP_ENV_VALIDATION && !process.env.DATABASE_URL);
}

function authUnavailableResponse(): Response {
	return Response.json(
		{
			error: "Auth is unavailable because DATABASE_URL is not configured.",
		},
		{ status: 503 },
	);
}

async function getAuthHandlers() {
	const [{ auth }, { toNextJsHandler }] = await Promise.all([
		import("@superset/auth/server"),
		import("better-auth/next-js"),
	]);

	return toNextJsHandler(auth);
}

/**
 * Normalize localhost variants in a URL so that `localhost` and `127.0.0.1`
 * are treated as equivalent. OAuth 2.1 requires exact string matching on
 * redirect_uri, but some MCP clients (e.g. OpenCode) register with
 * `127.0.0.1` and then authorize with `localhost` (or vice-versa).
 */
function normalizeLocalhostUri(uri: string): string {
	return uri.replace(/^(https?:\/\/)localhost(:\d+)/, "$1127.0.0.1$2");
}

const GET = async (req: Request) => {
	if (shouldSkipAuthHandlers()) {
		return authUnavailableResponse();
	}

	const { GET: _GET } = await getAuthHandlers();
	const url = new URL(req.url);
	if (url.pathname.endsWith("/oauth2/authorize")) {
		const redirectUri = url.searchParams.get("redirect_uri");
		if (redirectUri) {
			const normalized = normalizeLocalhostUri(redirectUri);
			if (normalized !== redirectUri) {
				url.searchParams.set("redirect_uri", normalized);
				return _GET(new Request(url.toString(), req));
			}
		}
	}
	return _GET(req);
};

const POST = async (req: Request) => {
	if (shouldSkipAuthHandlers()) {
		return authUnavailableResponse();
	}

	const { POST: _POST } = await getAuthHandlers();
	const url = new URL(req.url);
	if (url.pathname.endsWith("/oauth2/register")) {
		const cloned = req.clone();
		const body = await cloned.json().catch(() => null);
		if (body?.redirect_uris && Array.isArray(body.redirect_uris)) {
			body.redirect_uris = body.redirect_uris.map(normalizeLocalhostUri);
			return _POST(
				new Request(req.url, {
					method: req.method,
					headers: req.headers,
					body: JSON.stringify(body),
				}),
			);
		}
	}
	if (url.pathname.endsWith("/oauth2/token")) {
		const cloned = req.clone();
		const contentType = req.headers.get("content-type") ?? "";
		if (contentType.includes("application/json")) {
			const body = await cloned.json().catch(() => null);
			if (body?.redirect_uri && typeof body.redirect_uri === "string") {
				const normalized = normalizeLocalhostUri(body.redirect_uri);
				if (normalized !== body.redirect_uri) {
					body.redirect_uri = normalized;
					return _POST(
						new Request(req.url, {
							method: req.method,
							headers: req.headers,
							body: JSON.stringify(body),
						}),
					);
				}
			}
		} else {
			const params = new URLSearchParams(await cloned.text());
			const redirectUri = params.get("redirect_uri");
			if (redirectUri) {
				const normalized = normalizeLocalhostUri(redirectUri);
				if (normalized !== redirectUri) {
					params.set("redirect_uri", normalized);
					return _POST(
						new Request(req.url, {
							method: req.method,
							headers: req.headers,
							body: params.toString(),
						}),
					);
				}
			}
		}
	}
	return _POST(req);
};

export { GET, POST };
