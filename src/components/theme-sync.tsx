"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export function ThemeSync({ savedTheme }: { savedTheme?: string }) {
  const { setTheme } = useTheme();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current || !savedTheme) return;
    appliedRef.current = true;
    setTheme(savedTheme);
  }, [savedTheme, setTheme]);

  return null;
}
