"use client";
import React from "react";
import CardWrapper from "../card-wrapper";
import FormError from "../form-error";
import FormSuccess from "../form-success";
import { useAuthState } from "@/hooks/useAuthState";
import ResetPasswordSchema from "@/helpers/zod/reset-password-schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { resetPassword } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

const ResetPassword = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { error, success, loading, setSuccess, setError, setLoading, resetState } = useAuthState();

  const form = useForm<z.infer<typeof ResetPasswordSchema>>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof ResetPasswordSchema>) => {
    setLoading(true);

    if (!token) {
      setError("Reset token is missing");
      setLoading(false);
      return;
    }

    if (values.password !== values.confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    const {error} = await resetPassword({
      newPassword: values.password,
      token: token,
    });

    if (error) {
      setError(error.message ?? "Something went wrong");
      setLoading(false);
    } else {
      setSuccess("Password reset successfully");
      setTimeout(() => {
        router.replace("/sign-in");
      }, 2000);
      setLoading(false);
    }
  };

  return (
    <CardWrapper
      cardTitle="Reset Password"
      cardDescription="Enter your new password below"
    >
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input disabled={loading} type="password" placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input disabled={loading} type="password" placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormError message={error} />
          <FormSuccess message={success} />
          <Button disabled={loading} type="submit" className="w-full">
            Reset Password
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
};

export default ResetPassword;