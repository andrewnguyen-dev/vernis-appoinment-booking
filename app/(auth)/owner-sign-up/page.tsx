import { getOptionalAuth } from "@/lib/auth-utils";
import { isOwner } from "@/lib/user-utils";
import { redirect } from "next/navigation";

export default async function OwnerSignUpPage() {
  const session = await getOptionalAuth();

  // If user is already logged in, redirect them appropriately
  if (session?.user) {
    // Check if they're an owner
    const userIsOwner = await isOwner(session.user.id);
    if (userIsOwner) {
      // Owner logged in, redirect to dashboard
      redirect("/dashboard");
    } else {
      // Regular user logged in, redirect to homepage
      redirect("/");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-bold">Salon Owner Registration</h1>
        <p className="text-muted-foreground">Thank you for your interest in joining our platform as a salon owner.</p>
        <p className="text-sm text-muted-foreground">
          Please contact our team to set up your salon account and get started with managing your business.
        </p>
        <div className="space-y-2">
          <p className="font-medium">Contact us:</p>
          <p className="text-sm">
            Email:{" "}
            <a href="mailto:hello@vernis.app" className="custom-underline text-sm text-primary">
              hello@vernis.app
            </a>
          </p>
        </div>
        <p className=" text-sm text-primary">
          Already have an owner account?{" "}
          <a href="/owner-sign-in" className="custom-underline inline-block">
            Sign in here
          </a>
        </p>
      </div>
    </div>
  );
}
