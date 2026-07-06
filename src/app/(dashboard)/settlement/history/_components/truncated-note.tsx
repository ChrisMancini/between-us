"use client";

import { useRef, useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TruncatedNote({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setTruncated(el.scrollWidth > el.clientWidth);
  }, [text]);

  if (!truncated) {
    return (
      <span ref={ref} className="block truncate italic">
        {text}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <span ref={ref} className="block truncate italic text-left">
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{text}</TooltipContent>
    </Tooltip>
  );
}
