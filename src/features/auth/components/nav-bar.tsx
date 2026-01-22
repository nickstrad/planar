import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { UserNav } from "./user-nav";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { STATIC_PATHS } from "@/lib/constants";
import { AppLogo } from "@/components/app/AppLogo";

export async function NavBar() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="py-2 px-4 border-b">
      <nav className="flex items-center justify-between">
        <div className="flex">
          <Button asChild variant="ghost">
            <Link href={STATIC_PATHS.HOME}>
              <AppLogo />
            </Link>
          </Button>
          <AdminNav />
        </div>
        <div>
          {session?.user ? (
            <UserNav
              user={{
                ...session.user,
                image: session.user.image ?? null,
              }}
            />
          ) : (
            <Button asChild variant="ghost">
              <Link href={STATIC_PATHS.LOGIN}>Login</Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
