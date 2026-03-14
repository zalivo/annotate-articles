"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";

interface StackOption {
  id: string;
  title: string;
  slug: string;
  hasArticle: boolean;
}

interface Props {
  articleId: string;
  stacks: StackOption[];
}

export function AddToStackButton({ articleId, stacks }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<Set<string>>(
    new Set(stacks.filter((s) => s.hasArticle).map((s) => s.id))
  );
  const ref = useRef<HTMLDivElement>(null);

  const addArticle = trpc.stacks.addArticle.useMutation({
    onSuccess: (_, vars) => {
      setAdded((prev) => new Set([...prev, vars.stackId]));
    },
  });

  const removeArticle = trpc.stacks.removeArticle.useMutation({
    onSuccess: (_, vars) => {
      setAdded((prev) => {
        const next = new Set(prev);
        next.delete(vars.stackId);
        return next;
      });
    },
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggleStack(stackId: string) {
    if (added.has(stackId)) {
      removeArticle.mutate({ stackId, articleId });
    } else {
      addArticle.mutate({ stackId, articleId });
    }
  }

  if (stacks.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-70 cursor-pointer"
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--ink-muted)",
          fontFamily: "var(--font-geist-sans)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Add to stack
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-xl py-1 shadow-lg min-w-[200px]"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          {stacks.map((stack) => (
            <button
              key={stack.id}
              onClick={() => toggleStack(stack.id)}
              disabled={addArticle.isPending || removeArticle.isPending}
              className="w-full text-left px-3 py-2 text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              style={{
                color: "var(--ink)",
                fontFamily: "var(--font-geist-sans)",
              }}
            >
              <span
                className="shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px]"
                style={{
                  borderColor: added.has(stack.id) ? "var(--ink)" : "var(--border)",
                  background: added.has(stack.id) ? "var(--ink)" : "transparent",
                  color: added.has(stack.id) ? "var(--cream)" : "transparent",
                }}
              >
                {added.has(stack.id) && "✓"}
              </span>
              <span className="truncate">{stack.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
