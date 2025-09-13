import { auth } from "@/lib/auth";
import { isOwner } from "@/lib/user-utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  return session;
}

export async function requireOwnerAuth() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    redirect("/owner-sign-in");
  }

  // Verify user has owner privileges
  const userIsOwner = await isOwner(session.user.id);
  if (!userIsOwner) {
    redirect("/owner-sign-in");
  }

  return session;
}

export async function getOptionalAuth() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });
    return session;
  } catch {
    return null;
  }
}
