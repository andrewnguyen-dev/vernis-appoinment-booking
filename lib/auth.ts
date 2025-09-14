import ForgotPasswordEmail from "@/components/emails/reset-password";
import prisma from "@/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Resend } from "resend";
import * as React from "react";
import { render } from "@react-email/render";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const auth = betterAuth({
  appName: "better_auth_nextjs_looma",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 20,
    sendResetPassword: async ({ user, url }) => {
      // Render email using React Email
      const html = await render(React.createElement(ForgotPasswordEmail, { username: user.name, resetUrl: url, userEmail: user.email }));

      // Send email using Resend
      resend.emails.send({
        from: "onboarding@resend.dev",
        to: user.email,
        // to: 'andrewnguyen.nsw@gmail.com',
        subject: "Reset your password",
        html,
      });
    },
    onPasswordReset: async ({ user }, request) => {
      // your logic here
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },
});
