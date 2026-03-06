"use client";

import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { trpc } from "@/trpc/client";
import type { Paragraph } from "@/db/schema";

type Annotation = {
  id: string;
  startParagraphId: string;
  startOffset: number;
  endParagraphId: string;
  endOffset: number;
  highlightedText: string;
  comment: string;
  color: string;
};

interface Props {
  articleId: string;
  paragraphs: Paragraph[];
  readOnly?: boolean;
  initialAnnotations?: Annotation[];
}

interface PendingSelection {
  startParagraphId: string;
  startOffset: number;
  endParagraphId: string;
  endOffset: number;
  highlightedText: string;
  rect: { top: number; left: number; width: number };
}

export function ArticleReader({ articleId, paragraphs, readOnly = false, initialAnnotations = [] }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations as Annotation[]);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [comment, setComment] = useState("");
  const [saveError, setSaveError] = useState("");
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const createAnnotation = trpc.annotations.create.useMutation({
    onSuccess: (annotation) => {
      setAnnotations((prev) => [...prev, annotation as Annotation]);
      setPending(null);
      setComment("");
      setSaveError("");
    },
    onError: (err) => {
      setSaveError(
        err.data?.code === "UNAUTHORIZED"
          ? "Sign in to save annotations."
          : err.message ?? "Failed to save."
      );
    },
  });

  const deleteAnnotation = trpc.annotations.delete.useMutation({
    onSuccess: (_, variables) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== (variables as { id: string }).id));
      setActiveAnnotationId(null);
    },
  });

  // Map browser Selection to paragraph model
  const handleMouseUp = useCallback(() => {
    if (readOnly) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();
    if (!text || text.length < 3) return;

    // Find which paragraph elements the selection falls in
    const startEl = findParagraphElement(range.startContainer);
    const endEl = findParagraphElement(range.endContainer);
    if (!startEl || !endEl) return;

    const startParagraphId = startEl.dataset.paragraphId;
    const endParagraphId = endEl.dataset.paragraphId;
    if (!startParagraphId || !endParagraphId) return;

    // Calculate offsets relative to paragraph text content
    const startOffset = getOffsetInElement(startEl, range.startContainer, range.startOffset);
    const endOffset = getOffsetInElement(endEl, range.endContainer, range.endOffset);

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    setPending({
      startParagraphId,
      startOffset,
      endParagraphId,
      endOffset,
      highlightedText: text,
      rect: {
        top: rect.bottom - containerRect.top + 8,
        left: Math.max(0, rect.left - containerRect.left),
        width: rect.width,
      },
    });

    // Focus comment input after paint
    setTimeout(() => commentInputRef.current?.focus(), 50);
  }, [readOnly]);

  function saveAnnotation() {
    if (!pending || !comment.trim()) return;
    setSaveError("");
    createAnnotation.mutate({
      articleId,
      ...pending,
      comment: comment.trim(),
      color: "yellow",
    });
  }

  function cancelPending() {
    setPending(null);
    setComment("");
    setSaveError("");
    window.getSelection()?.removeAllRanges();
  }

  // Build a map: paragraphId → list of highlights with their offsets
  const highlightMap = buildHighlightMap(annotations);

  return (
    <div ref={containerRef} className="relative">
      {/* Two-column layout: article + sidebar */}
      <div className="flex gap-0">
        {/* Article column */}
        <div className="flex-1 min-w-0">
          <article
            className="flex flex-col gap-5"
            onMouseUp={handleMouseUp}
          >
            {paragraphs.map((p) => (
              <ParagraphBlock
                key={p.id}
                paragraph={p}
                highlights={highlightMap[p.id] ?? []}
                activeAnnotationId={activeAnnotationId}
                onHighlightClick={(id) =>
                  setActiveAnnotationId((prev) => (prev === id ? null : id))
                }
              />
            ))}
          </article>
        </div>

        {/* Sidebar — margin comments */}
        <div className="hidden lg:block w-72 shrink-0 pl-10 relative">
          <CommentSidebar
            annotations={annotations}
            paragraphs={paragraphs}
            activeAnnotationId={activeAnnotationId}
            onSelect={setActiveAnnotationId}
            onDelete={readOnly ? undefined : (id) => deleteAnnotation.mutate({ id })}
          />
        </div>
      </div>

      {/* Floating comment popover */}
      {pending && (
        <div
          className="absolute z-50 w-72 rounded-xl shadow-xl border overflow-hidden"
          style={{
            top: pending.rect.top,
            left: Math.min(pending.rect.left, (containerRef.current?.offsetWidth ?? 680) - 300),
            background: "#fff",
            borderColor: "var(--border)",
            boxShadow: "0 8px 32px rgba(28,23,16,0.14)",
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p
              className="text-xs line-clamp-2 italic"
              style={{ color: "var(--ink-muted)", fontFamily: "var(--font-lora)" }}
            >
              &ldquo;{pending.highlightedText}&rdquo;
            </p>
          </div>
          <div className="p-3 flex flex-col gap-2">
            <textarea
              ref={commentInputRef}
              value={comment}
              onChange={(e) => { setComment(e.target.value); setSaveError(""); }}
              placeholder="Add a comment…"
              rows={3}
              className="w-full resize-none outline-none text-sm leading-relaxed"
              style={{
                color: "var(--ink)",
                fontFamily: "var(--font-geist-sans)",
                background: "transparent",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveAnnotation();
                if (e.key === "Escape") cancelPending();
              }}
            />
            {saveError && (
              <p className="text-xs px-0.5" style={{ color: "#D94F3D", fontFamily: "var(--font-geist-sans)" }}>
                {saveError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelPending}
                className="px-3 py-1.5 text-xs rounded-lg transition-opacity hover:opacity-60 cursor-pointer"
                style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
              >
                Cancel
              </button>
              <button
                onClick={saveAnnotation}
                disabled={createAnnotation.isPending || !comment.trim()}
                className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                style={{
                  background: "var(--ink)",
                  color: "var(--cream)",
                  fontFamily: "var(--font-geist-sans)",
                }}
              >
                {createAnnotation.isPending ? "Saving…" : "Save ↵"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile: active annotation card */}
      {activeAnnotationId && (
        <MobileAnnotationCard
          annotation={annotations.find((a) => a.id === activeAnnotationId)!}
          onClose={() => setActiveAnnotationId(null)}
          onDelete={readOnly ? undefined : (id) => deleteAnnotation.mutate({ id })}
        />
      )}
    </div>
  );
}

// ─── Paragraph block with inline highlights ───────────────────────────────────

interface HighlightRange {
  annotationId: string;
  start: number;
  end: number;
  color: string;
}

function ParagraphBlock({
  paragraph,
  highlights,
  activeAnnotationId,
  onHighlightClick,
}: {
  paragraph: Paragraph;
  highlights: HighlightRange[];
  activeAnnotationId: string | null;
  onHighlightClick: (id: string) => void;
}) {
  const { type, text, id } = paragraph;

  const content = highlights.length > 0
    ? renderWithHighlights(text, highlights, activeAnnotationId, onHighlightClick)
    : text;

  const baseStyle = {
    color: "var(--ink)",
    fontFamily: "var(--font-lora)",
    fontSize: "1.05rem",
    lineHeight: "1.85",
  };

  if (type === "h1") {
    return (
      <h1
        data-paragraph-id={id}
        className="text-3xl leading-tight mt-6 first:mt-0"
        style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
      >
        {content}
      </h1>
    );
  }
  if (type === "h2") {
    return (
      <h2
        data-paragraph-id={id}
        className="text-2xl leading-snug mt-5 first:mt-0"
        style={{ fontFamily: "var(--font-lora)", color: "var(--ink)" }}
      >
        {content}
      </h2>
    );
  }
  if (type === "h3" || type === "h4" || type === "h5" || type === "h6") {
    return (
      <h3
        data-paragraph-id={id}
        className="text-lg font-semibold leading-snug mt-4 first:mt-0"
        style={{ fontFamily: "var(--font-geist-sans)", color: "var(--ink)" }}
      >
        {content}
      </h3>
    );
  }
  if (type === "blockquote") {
    return (
      <blockquote
        data-paragraph-id={id}
        className="pl-5 py-1 border-l-2 italic"
        style={{
          borderColor: "var(--highlight)",
          color: "var(--ink-muted)",
          fontFamily: "var(--font-lora)",
          fontSize: "1.05rem",
          lineHeight: "1.75",
        }}
      >
        {content}
      </blockquote>
    );
  }
  if (type === "li") {
    return (
      <li
        data-paragraph-id={id}
        className="ml-5 list-disc"
        style={baseStyle}
      >
        {content}
      </li>
    );
  }
  return (
    <p data-paragraph-id={id} style={baseStyle}>
      {content}
    </p>
  );
}

function renderWithHighlights(
  text: string,
  highlights: HighlightRange[],
  activeAnnotationId: string | null,
  onHighlightClick: (id: string) => void
): React.ReactNode[] {
  // Sort and build non-overlapping segments
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const segments: React.ReactNode[] = [];
  let cursor = 0;

  for (const h of sorted) {
    if (h.start > cursor) {
      segments.push(text.slice(cursor, h.start));
    }
    const start = Math.max(h.start, cursor);
    const end = Math.min(h.end, text.length);
    if (start < end) {
      const isActive = h.annotationId === activeAnnotationId;
      segments.push(
        <mark
          key={h.annotationId}
          data-annotation-id={h.annotationId}
          onClick={() => onHighlightClick(h.annotationId)}
          className="cursor-pointer rounded-sm transition-colors"
          style={{
            background: isActive ? "var(--highlight)" : "var(--highlight-dim)",
            color: "var(--ink)",
            padding: "1px 1px",
          }}
        >
          {text.slice(start, end)}
        </mark>
      );
      cursor = end;
    }
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  return segments;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function CommentSidebar({
  annotations,
  paragraphs,
  activeAnnotationId,
  onSelect,
  onDelete,
}: {
  annotations: Annotation[];
  paragraphs: Paragraph[];
  activeAnnotationId: string | null;
  onSelect: (id: string | null) => void;
  onDelete?: (id: string) => void;
}) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [offsets, setOffsets] = useState<Record<string, number>>({});

  // Vertically align each card with its highlight in the article
  useLayoutEffect(() => {
    const newOffsets: Record<string, number> = {};
    let minTop = 0;

    for (const ann of annotations) {
      const el = document.querySelector<HTMLElement>(
        `[data-paragraph-id="${ann.startParagraphId}"]`
      );
      if (!el) continue;

      const container = el.closest("[data-article-container]") ?? document.body;
      const containerTop = container.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top - containerTop;

      const top = Math.max(elTop, minTop);
      newOffsets[ann.id] = top;

      const cardHeight = cardRefs.current[ann.id]?.offsetHeight ?? 80;
      minTop = top + cardHeight + 12;
    }

    setOffsets(newOffsets);
  }, [annotations]);

  if (annotations.length === 0) {
    return (
      <p
        className="text-xs pt-2"
        style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
      >
        Select text to annotate.
      </p>
    );
  }

  return (
    <div className="relative" style={{ minHeight: "100%" }}>
      {annotations.map((ann) => {
        const isActive = ann.id === activeAnnotationId;
        return (
          <div
            key={ann.id}
            ref={(el) => { cardRefs.current[ann.id] = el; }}
            className="absolute w-full"
            style={{ top: offsets[ann.id] ?? 0 }}
          >
            <div
              onClick={() => onSelect(isActive ? null : ann.id)}
              className="rounded-lg p-3 cursor-pointer transition-all"
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
                boxShadow: isActive ? "0 2px 8px rgba(28,23,16,0.08)" : "none",
              }}
            >
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}
              >
                {ann.comment}
              </p>
              {isActive && onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(ann.id);
                  }}
                  className="mt-2 text-xs transition-opacity hover:opacity-60 cursor-pointer"
                  style={{ color: "#D94F3D", fontFamily: "var(--font-geist-sans)" }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Mobile annotation card ───────────────────────────────────────────────────

function MobileAnnotationCard({
  annotation,
  onClose,
  onDelete,
}: {
  annotation: Annotation;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  if (!annotation) return null;
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-4">
      <div
        className="rounded-2xl p-4 shadow-2xl"
        style={{
          background: "#fff",
          border: "1px solid var(--border)",
          boxShadow: "0 -4px 32px rgba(28,23,16,0.12)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <p
            className="text-xs italic line-clamp-2"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-lora)" }}
          >
            &ldquo;{annotation.highlightedText}&rdquo;
          </p>
          <button onClick={onClose} className="shrink-0 opacity-40 hover:opacity-70 transition-opacity cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="text-sm" style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}>
          {annotation.comment}
        </p>
        {onDelete && (
          <button
            onClick={() => onDelete(annotation.id)}
            className="mt-3 text-xs transition-opacity hover:opacity-60 cursor-pointer"
            style={{ color: "#D94F3D", fontFamily: "var(--font-geist-sans)" }}
          >
            Delete annotation
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findParagraphElement(node: Node): HTMLElement | null {
  let el: Node | null = node;
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.dataset.paragraphId) return el;
    el = el.parentNode;
  }
  return null;
}

function getOffsetInElement(container: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total + offset;
}

function buildHighlightMap(annotations: Annotation[]): Record<string, HighlightRange[]> {
  const map: Record<string, HighlightRange[]> = {};
  for (const ann of annotations) {
    // For same-paragraph highlights
    if (ann.startParagraphId === ann.endParagraphId) {
      if (!map[ann.startParagraphId]) map[ann.startParagraphId] = [];
      map[ann.startParagraphId].push({
        annotationId: ann.id,
        start: ann.startOffset,
        end: ann.endOffset,
        color: ann.color,
      });
    } else {
      // Cross-paragraph: highlight to end of start paragraph, from start of end paragraph
      if (!map[ann.startParagraphId]) map[ann.startParagraphId] = [];
      map[ann.startParagraphId].push({
        annotationId: ann.id,
        start: ann.startOffset,
        end: Infinity,
        color: ann.color,
      });
      if (!map[ann.endParagraphId]) map[ann.endParagraphId] = [];
      map[ann.endParagraphId].push({
        annotationId: ann.id,
        start: 0,
        end: ann.endOffset,
        color: ann.color,
      });
    }
  }
  return map;
}
