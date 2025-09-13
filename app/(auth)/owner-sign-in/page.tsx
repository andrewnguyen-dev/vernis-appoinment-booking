import OwnerSignIn from "@/components/auth/owner-sign-in";
import { getOptionalAuth } from "@/lib/auth-utils";
import { isOwner } from "@/lib/user-utils";
import { redirect } from "next/navigation";

export default async function OwnerSignInPage() {
  const session = await getOptionalAuth();
  
  // If user is already logged in, redirect them appropriately
  if (session?.user) {
    // Check if they're an owner
    const userIsOwner = await isOwner(session.user.id);
    if (userIsOwner) {
      // Owner is already logged in, redirect to dashboard
      redirect("/dashboard");
    } else {
      // Regular user trying to access owner sign-in, redirect to homepage
      redirect("/");
    }
  }

  return <OwnerSignIn />;
}
