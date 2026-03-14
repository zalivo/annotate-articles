"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";

interface Props {
  onClose: () => void;
}

export function CreateStackForm({ onClose }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");

  const create = trpc.stacks.create.useMutation({
    onSuccess: (stack) => {
      router.push(`/stack/${stack.slug}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      visibility,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-5 mb-6"
      style={{
        border: "1px solid var(--border)",
        background: "var(--cream)",
        fontFamily: "var(--font-geist-sans)",
      }}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label
            className="block text-xs font-medium mb-1.5"
            style={{ color: "var(--ink-muted)" }}
          >
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Best essays on AI safety"
            maxLength={200}
            autoFocus
            className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
            style={{
              border: "1px solid var(--border)",
              color: "var(--ink)",
              background: "white",
              fontFamily: "var(--font-geist-sans)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--ink-muted)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium mb-1.5"
            style={{ color: "var(--ink-muted)" }}
          >
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this collection about?"
            maxLength={1000}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all resize-none"
            style={{
              border: "1px solid var(--border)",
              color: "var(--ink)",
              background: "white",
              fontFamily: "var(--font-geist-sans)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--ink-muted)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setVisibility(visibility === "private" ? "public" : "private")}
            className="flex items-center gap-1.5 text-xs cursor-pointer"
            style={{ color: "var(--ink-muted)" }}
          >
            {visibility === "private" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5 6V4.5a2 2 0 0 1 4 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Private — only you can see
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M2 7h10M7 2c-1.5 1.5-2 3.2-2 5s.5 3.5 2 5M7 2c1.5 1.5 2 3.2 2 5s-.5 3.5-2 5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                Public — anyone with the link
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || create.isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            style={{
              background: "var(--ink)",
              color: "var(--cream)",
            }}
          >
            {create.isPending ? "Creating…" : "Create Stack"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium transition-all hover:opacity-60 cursor-pointer"
            style={{
              color: "var(--ink-muted)",
              border: "1px solid var(--border)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
