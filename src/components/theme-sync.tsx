"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export function ThemeSync({ savedTheme }: { savedTheme?: string }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (savedTheme) setTheme(savedTheme);
  }, [savedTheme, setTheme]);

  return null;
}
