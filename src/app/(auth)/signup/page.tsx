import { SignUpForm } from "@/features/auth/components/signup-form";
import { requireUnauth } from "@/lib/auth-utils";

export default async function LoginPage() {
  await requireUnauth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <SignUpForm />
    </main>
  );
}
