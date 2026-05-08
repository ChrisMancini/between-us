import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { auth, signOut } from "@/auth";
import { AppFooter } from "@/components/app-footer";
import { NavLinks } from "@/components/nav-links";
import { ActivityPoller } from "@/components/activity-poller";
import { PersonsProvider } from "@/components/persons-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getPersons } from "@/lib/persons";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "admin";
  const persons = await getPersons();
  if (!persons) redirect("/setup");

  return (
    <div className="min-h-screen flex flex-col bg-muted/50">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 shadow-sm shadow-border/50">
        <div className="flex h-14 items-center gap-6 px-6 max-w-screen-xl mx-auto">

          {/* Brand mark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/40">
              <Receipt className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight">Between Us</span>
          </div>

          <NavLinks isAdmin={isAdmin} />

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground hidden sm:block">
              {session.user.name?.split(" ")[0]}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-screen-xl mx-auto w-full">
        <PersonsProvider persons={persons}>
          <ActivityPoller />
          {children}
        </PersonsProvider>
      </main>

      <AppFooter />
    </div>
  );
}
