## Middleware

In Next.js middleware, it's recommended to only check for the existence of a session cookie to handle redirection. To avoid blocking requests by making API or database calls.

You can use the getSessionCookie helper from Better Auth for this purpose:

[Warning] The getSessionCookie() function does not automatically reference the auth config specified in auth.ts. Therefore, if you customized the cookie name or prefix, you need to ensure that the configuration in getSessionCookie() matches the config defined in your auth.ts.

```
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);
    // THIS IS NOT SECURE!
    // This is the recommended approach to optimistically redirect users
    // We recommend handling auth checks in each page/route
	if (!sessionCookie) {
		return NextResponse.redirect(new URL("/", request.url));
	}
	return NextResponse.next();
}
export const config = {
	matcher: ["/dashboard"], // Specify the routes the middleware applies to
};
```

[Security Warning] The getSessionCookie function only checks for the existence of a session cookie; it does not validate it. Relying solely on this check for security is dangerous, as anyone can manually create a cookie to bypass it. You must always validate the session on your server for any protected actions or pages.

[Info] If you have a custom cookie name or prefix, you can pass it to the getSessionCookie function:
```
const sessionCookie = getSessionCookie(request, {
    cookieName: "my_session_cookie",
    cookiePrefix: "my_prefix"
});
```

Alternatively, you can use the getCookieCache helper to get the session object from the cookie cache:
```
import { getCookieCache } from "better-auth/cookies";
export async function middleware(request: NextRequest) {
	const session = await getCookieCache(request);
	if (!session) {
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}
	return NextResponse.next();
}
```

## How to handle auth checks in each page/route
In this example, we are using the auth.api.getSession function within a server component to get the session object, then we are checking if the session is valid. If it's not, we are redirecting the user to the sign-in page.

```
// app/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if(!session) {
        redirect("/sign-in")
    }
    return (
        <div>
            <h1>Welcome {session.user.name}</h1>
        </div>
    )
}
```