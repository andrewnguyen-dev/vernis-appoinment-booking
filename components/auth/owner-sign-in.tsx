"use client";
import React from "react";
import CardWrapper from "../card-wrapper";
import FormError from "../form-error";
import FormSuccess from "../form-success";
import { useAuthState } from "@/hooks/useAuthState";
import LoginSchema from "@/helpers/zod/login-schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { signIn } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const OwnerSignIn = () => {
  const router = useRouter();
  const { error, success, loading, setSuccess, setError, setLoading, resetState } = useAuthState();

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof LoginSchema>) => {
    try {
      await signIn.email(
        {
          email: values.email,
          password: values.password,
        },
        {
          onResponse: () => {
            setLoading(false);
          },
          onRequest: () => {
            resetState();
            setLoading(true);
          },
          onSuccess: async () => {
            // Verify user has salon owner membership
            const response = await fetch('/api/auth/verify-owner');
            if (response.ok) {
              setSuccess("Logged in successfully");
              router.replace("/dashboard");
            } else {
              setError("Access denied. Owner privileges required.");
              // Sign out the user if they don't have owner access
              await fetch('/api/auth/signout', { method: 'POST' });
            }
          },
          onError: (ctx) => {
            setError(ctx.error.message);
          },
        }
      );
    } catch (error) {
      console.log(error);
      setError("Something went wrong");
    }
  };

  return (
    <CardWrapper
      cardTitle="Salon Owner Sign In"
      cardDescription="Sign in to your salon management dashboard"
      cardFooterDescription="Don't have an owner account?"
      cardFooterLink="/owner-sign-up"
      cardFooterLinkTitle="Contact us"
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
                  <Input disabled={loading} type="email" placeholder="owner@salon.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input disabled={loading} type="password" placeholder="********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <a href="/forgot-password" className="flex justify-end self-end text-sm">
            Forgot your password?
          </a>
          <FormError message={error} />
          <FormSuccess message={success} />
          <Button disabled={loading} type="submit" className="w-full">
            Sign In as Owner
          </Button>
        </form>
      </Form>
      <div className="mt-4 text-center">
        <a href="/sign-in" className="custom-underline text-sm text-muted-foreground">
          Sign in as a regular customer instead
        </a>
      </div>
    </CardWrapper>
  );
};

export default OwnerSignIn;
