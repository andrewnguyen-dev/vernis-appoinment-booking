import SignUp from '@/components/auth/sign-up'
import { getOptionalAuth } from "@/lib/auth-utils";
import { isOwner } from "@/lib/user-utils";
import { redirect } from "next/navigation";
import React from 'react'

const SignupPage = async () => {
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
    <SignUp />
  )
}

export default SignupPage