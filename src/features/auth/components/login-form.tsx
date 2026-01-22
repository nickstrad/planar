"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { STATIC_PATHS } from "@/lib/constants";
import { AppLogo } from "@/components/app/AppLogo";

const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    await authClient.signIn.email(
      {
        email: values.email,
        password: values.password,
        callbackURL: STATIC_PATHS.HOME,
      },
      {
        onSuccess: () => {
          router.push(STATIC_PATHS.HOME);
        },
        onError: (ctx) => {
          console.error("Error:", ctx.error);
          toast.error(ctx.error.message);
        },
      }
    );
  };

  const signInGoogle = async () => {
    await authClient.signIn.social(
      {
        provider: "google",
      },
      {
        onSuccess: () => {
          router.push(STATIC_PATHS.HOME);
        },
        onError: () => {
          toast.error("Something went wrong.");
        },
      }
    );
  };
  const isPending = form.formState.isSubmitting;

  return (
    <div className="flex flex-col items-center gap-6">
      <AppLogo width={40} height={40} />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <CardContent className="grid gap-4">
              <Button
                variant="outline"
                className="w-full"
                type="button"
                disabled={isPending}
                onClick={signInGoogle}
              >
                <Image
                  src="/logos/google.svg"
                  alt="Google Logo"
                  width={20}
                  height={20}
                  className="mr-2"
                />
                Continue with Google
              </Button>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        required
                        {...field}
                      />
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
                      <Input type="password" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button className="w-full">Sign in</Button>
              <p className="text-sm">
                {`Don't have an account? `}
                <Link
                  href={STATIC_PATHS.SIGNUP}
                  className="text-blue-500 hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
