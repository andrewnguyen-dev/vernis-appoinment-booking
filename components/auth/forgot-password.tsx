"use client";
import React from "react";
import CardWrapper from "../card-wrapper";
import FormError from "../form-error";
import FormSuccess from "../form-success";
import { useAuthState } from "@/hooks/useAuthState";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { forgetPassword } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import ForgotPasswordSchema from "@/helpers/zod/forgot-password-schema";

const ForgotPassword = () => {
  const router = useRouter();
  const { error, success, loading, setSuccess, setError, setLoading, resetState } = useAuthState();

  const form = useForm<z.infer<typeof ForgotPasswordSchema>>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof ForgotPasswordSchema>) => {
    setLoading(true);

    const { error } = await forgetPassword({
      email: values.email, // required
      redirectTo: "/reset-password",
    });

    if (error) {
      setError(error.message ?? "Something went wrong");
    } else {
      setSuccess("Password reset email sent");
    }
    setLoading(false);
  };

  return (
    <CardWrapper
      cardTitle="Forgot Password"
      cardDescription="Enter your email below to receive a password reset link"
      cardFooterDescription="Remembered your password?"
      cardFooterLink="/sign-in"
      cardFooterLinkTitle="Sign in"
    >
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input disabled={loading} type="email" placeholder="example@gmail.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormError message={error} />
          <FormSuccess message={success} />
          <Button disabled={loading} type="submit" className="w-full">
            Send Reset Link
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
};

export default ForgotPassword;
