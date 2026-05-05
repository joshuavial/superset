import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const publicRoutes = [
	"/sign-in",
	"/sign-up",
	"/auth/desktop",
	"/api/auth/desktop",
	"/accept-invitation",
];

function isPublicRoute(pathname: string): boolean {
	return publicRoutes.some((route) => pathname.startsWith(route));
}

function shouldSkipAuthSessionLookup(): boolean {
	return Boolean(process.env.SKIP_ENV_VALIDATION && !process.env.DATABASE_URL);
}

export default async function proxy(req: NextRequest) {
	const pathname = req.nextUrl.pathname;

	if (shouldSkipAuthSessionLookup()) {
		if (!isPublicRoute(pathname)) {
			return NextResponse.redirect(new URL("/sign-in", req.url));
		}

		return NextResponse.next();
	}

	const { auth } = await import("@superset/auth/server");
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		session &&
		(pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up"))
	) {
		return NextResponse.redirect(new URL("/", req.url));
	}

	if (!session && !isPublicRoute(pathname)) {
		return NextResponse.redirect(new URL("/sign-in", req.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!_next|ingest|monitoring|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		"/(api|trpc)(.*)",
	],
};
