import { SiGithub } from "react-icons/si";

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE;

const formattedDate = buildDate
  ? new Date(buildDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  : "";

export function AppFooter() {
  return (
    <footer className="border-t border-border px-6 py-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
      <span>
        Between Us v{version} · {sha}
        {formattedDate && ` · ${formattedDate}`}
      </span>
      <a
        href="https://github.com/ChrisMancini/between-us"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="GitHub repository"
      >
        <SiGithub className="w-3.5 h-3.5" />
      </a>
    </footer>
  );
}
