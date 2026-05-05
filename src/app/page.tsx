import { redirect } from "next/navigation";

// Middleware handles auth gating — this just points to the main section.
export default function Home() {
  redirect("/dashboard");
}
