"use client";

import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from "react";
import { trpc } from "@/trpc/client";
import type { Paragraph } from "@/db/schema";

type Annotation = {
  id: string;
  creatorId?: string;
  startParagraphId: string;
  startOffset: number;
  endParagraphId: string;
  endOffset: number;
  highlightedText: string;
  comment: string | null;
  color: string;
  visibility?: string;
  creatorName?: string | null;
};

interface Props {
  articleId: string;
  paragraphs: Paragraph[];
  readOnly?: boolean;
  initialAnnotations?: Annotation[];
  currentUserId?: string;
}

interface PendingSelection {
  startParagraphId: string;
  startOffset: number;
  endParagraphId: string;
  endOffset: number;
  highlightedText: string;
  rect: { top: number; left: number; width: number };
}

const HIGHLIGHT_COLORS: Record<string, { active: string; dim: string }> = {
  yellow: { active: "#FFC800", dim: "#FFE566" },
  orange: { active: "#FF8C00", dim: "#FFBB66" },
  green:  { active: "#5DC957", dim: "#A8E6A3" },
  teal:   { active: "#00B5A3", dim: "#6DDDD3" },
  blue:   { active: "#4AA8FF", dim: "#93C9FF" },
  purple: { active: "#9B6DFF", dim: "#C9AAFF" },
  pink:   { active: "#FF7099", dim: "#FFB3CC" },
};

export function ArticleReader({ articleId, paragraphs, readOnly = false, initialAnnotations = [], currentUserId }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations as Annotation[]);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [comment, setComment] = useState("");
  const [selectedColor, setSelectedColor] = useState("yellow");
  const [selectedVisibility, setSelectedVisibility] = useState<"private" | "public">("private");
  const [saveError, setSaveError] = useState("");
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [resizingAnnotationId, setResizingAnnotationId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ annotationId: string; edge: "start" | "end" } | null>(null);
  const [showCommunity, setShowCommunity] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  // Split annotations into own vs others
  const myAnnotations = annotations.filter((a) => !currentUserId || a.creatorId === currentUserId || !a.creatorId);
  const othersAnnotations = annotations.filter((a) => currentUserId && a.creatorId && a.creatorId !== currentUserId);
  const hasOthersAnnotations = othersAnnotations.length > 0;

  // Annotations to display: always show own, optionally show others
  const displayAnnotations = showCommunity ? annotations : myAnnotations;

  const createAnnotation = trpc.annotations.create.useMutation({
    onSuccess: (annotation) => {
      setAnnotations((prev) => [...prev, { ...annotation, creatorId: currentUserId, visibility: selectedVisibility } as Annotation]);
      setPending(null);
      setComment("");
      setSelectedColor("yellow");
      setSelectedVisibility("private");
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

  const updateAnnotation = trpc.annotations.update.useMutation({
    onSuccess: (updated) => {
      if (!updated) return;
      setAnnotations((prev) =>
        prev.map((a) => a.id === updated.id ? { ...a, visibility: updated.visibility, comment: updated.comment } : a)
      );
    },
  });

  const updateSpan = trpc.annotations.updateSpan.useMutation();

  // Map browser Selection to paragraph model
  const handleMouseUp = useCallback(() => {
    if (readOnly || dragging) return;
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

    // Clear browser selection so our custom highlight preview is visible
    sel.removeAllRanges();

    // Focus comment input after paint
    setTimeout(() => commentInputRef.current?.focus(), 50);
  }, [readOnly, dragging]);

  function saveAnnotation() {
    if (!pending || !comment.trim()) return;
    setSaveError("");
    createAnnotation.mutate({
      articleId,
      ...pending,
      comment: comment.trim(),
      color: selectedColor,
      visibility: selectedVisibility,
    });
  }

  function saveHighlightOnly() {
    if (!pending) return;
    setSaveError("");
    createAnnotation.mutate({
      articleId,
      ...pending,
      color: selectedColor,
      visibility: selectedVisibility,
    });
  }

  function cancelPending() {
    setPending(null);
    setComment("");
    setSelectedColor("yellow");
    setSelectedVisibility("private");
    setSaveError("");
    window.getSelection()?.removeAllRanges();
  }

  function toggleVisibility(ann: Annotation) {
    const newVis = ann.visibility === "public" ? "private" : "public";
    updateAnnotation.mutate({ id: ann.id, visibility: newVis });
  }

  // Drag-resize: handle mousemove/mouseup on document while dragging a handle
  useEffect(() => {
    if (!dragging) return;

    // Hide all handles/marks from hit-testing so caretRangeFromPoint lands on real text
    const marks = containerRef.current?.querySelectorAll<HTMLElement>("mark, [data-drag-handle]");
    marks?.forEach((el) => { el.style.pointerEvents = "none"; });

    function handleMouseMove(e: MouseEvent) {
      e.preventDefault();
      const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (!caretRange) return;
      const paragraphEl = findParagraphElement(caretRange.startContainer);
      if (!paragraphEl) return;
      const paragraphId = paragraphEl.dataset.paragraphId;
      if (!paragraphId) return;
      const offset = getOffsetInElement(paragraphEl, caretRange.startContainer, caretRange.startOffset);

      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id !== dragging!.annotationId) return a;
          if (dragging!.edge === "start") {
            // Don't allow start to go past end
            const endPIdx = paragraphs.findIndex((p) => p.id === a.endParagraphId);
            const newPIdx = paragraphs.findIndex((p) => p.id === paragraphId);
            if (newPIdx > endPIdx || (newPIdx === endPIdx && offset >= a.endOffset)) return a;
            return { ...a, startParagraphId: paragraphId, startOffset: offset };
          } else {
            // Don't allow end to go before start
            const startPIdx = paragraphs.findIndex((p) => p.id === a.startParagraphId);
            const newPIdx = paragraphs.findIndex((p) => p.id === paragraphId);
            if (newPIdx < startPIdx || (newPIdx === startPIdx && offset <= a.startOffset)) return a;
            return { ...a, endParagraphId: paragraphId, endOffset: offset };
          }
        })
      );
    }

    function handleMouseUp() {
      // Save the final position using ref to get latest state
      const ann = annotationsRef.current.find((a) => a.id === dragging!.annotationId);
      if (ann) {
        const text = getHighlightedText(paragraphs, ann.startParagraphId, ann.startOffset, ann.endParagraphId, ann.endOffset);
        if (text.length >= 1) {
          updateSpan.mutate({
            id: ann.id,
            startParagraphId: ann.startParagraphId,
            startOffset: ann.startOffset,
            endParagraphId: ann.endParagraphId,
            endOffset: ann.endOffset,
            highlightedText: text,
          });
        }
      }
      setDragging(null);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Restore pointer-events
      marks?.forEach((el) => { el.style.pointerEvents = ""; });
    };
  }, [dragging, paragraphs]);

  function startDrag(annotationId: string, edge: "start" | "end") {
    setDragging({ annotationId, edge });
  }

  // Build a map: paragraphId → list of highlights with their offsets
  const highlightMap = buildHighlightMap(displayAnnotations, currentUserId);

  // Inject pending selection as a live preview highlight
  if (pending) {
    const previewRange: HighlightRange = {
      annotationId: "__pending__",
      start: pending.startOffset,
      end: pending.endOffset,
      color: selectedColor,
      isOthers: false,
      edge: "both",
    };
    if (pending.startParagraphId === pending.endParagraphId) {
      if (!highlightMap[pending.startParagraphId]) highlightMap[pending.startParagraphId] = [];
      highlightMap[pending.startParagraphId].push(previewRange);
    } else {
      if (!highlightMap[pending.startParagraphId]) highlightMap[pending.startParagraphId] = [];
      highlightMap[pending.startParagraphId].push({ ...previewRange, end: Infinity, edge: "start" });
      if (!highlightMap[pending.endParagraphId]) highlightMap[pending.endParagraphId] = [];
      highlightMap[pending.endParagraphId].push({ ...previewRange, start: 0, edge: "end" });
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (readOnly) return;
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in an input/textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.key === "Escape") {
        if (resizingAnnotationId) {
          setResizingAnnotationId(null);
        } else if (pending) {
          cancelPending();
        } else if (activeAnnotationId) {
          setActiveAnnotationId(null);
        }
        return;
      }

      // Cmd/Ctrl+H = save as highlight-only when there's a pending selection
      if (e.key === "h" && pending && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveHighlightOnly();
        return;
      }

      // Navigate between annotations with j/k
      if ((e.key === "j" || e.key === "k") && !pending) {
        const sorted = [...displayAnnotations].sort((a, b) => {
          const pA = paragraphs.findIndex((p) => p.id === a.startParagraphId);
          const pB = paragraphs.findIndex((p) => p.id === b.startParagraphId);
          return pA !== pB ? pA - pB : a.startOffset - b.startOffset;
        });
        if (sorted.length === 0) return;
        const currentIdx = activeAnnotationId ? sorted.findIndex((a) => a.id === activeAnnotationId) : -1;
        const nextIdx = e.key === "j"
          ? Math.min(currentIdx + 1, sorted.length - 1)
          : Math.max(currentIdx - 1, 0);
        const next = sorted[nextIdx];
        setActiveAnnotationId(next.id);

        // Scroll the highlight into view
        const el = document.querySelector(`[data-annotation-id="${next.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readOnly, pending, activeAnnotationId, resizingAnnotationId, displayAnnotations, paragraphs]);

  return (
    <div ref={containerRef} className="relative" onClick={() => { setActiveAnnotationId(null); }}>
      {/* Community highlights toggle */}
      {hasOthersAnnotations && !readOnly && (
        <div
          className="flex items-center gap-2 mb-6 pb-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={() => setShowCommunity((v) => !v)}
            className="flex items-center gap-2 text-xs transition-opacity hover:opacity-70 cursor-pointer"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
          >
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded border transition-colors"
              style={{
                borderColor: showCommunity ? "var(--ink)" : "var(--ink-faint)",
                background: showCommunity ? "var(--ink)" : "transparent",
              }}
            >
              {showCommunity && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="var(--cream)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            Show community highlights ({othersAnnotations.length})
          </button>
        </div>
      )}

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
                resizingAnnotationId={resizingAnnotationId}
                onHighlightClick={(id) =>
                  setActiveAnnotationId((prev) => (prev === id ? null : id))
                }
                onHandleDragStart={startDrag}
              />
            ))}
          </article>
        </div>

        {/* Sidebar — margin comments */}
        <div className="hidden lg:block w-72 shrink-0 pl-10 relative">
          <CommentSidebar
            annotations={displayAnnotations.filter((a) => a.comment)}
            paragraphs={paragraphs}
            activeAnnotationId={activeAnnotationId}
            onSelect={setActiveAnnotationId}
            onDelete={readOnly ? undefined : (id) => deleteAnnotation.mutate({ id })}
            onToggleVisibility={readOnly ? undefined : toggleVisibility}
            onResize={readOnly ? undefined : (id) => { setResizingAnnotationId(id); setActiveAnnotationId(null); }}
            readerRef={containerRef}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      {/* Floating delete popover for highlight-only annotations */}
      {!readOnly && activeAnnotationId && (() => {
        const ann = displayAnnotations.find((a) => a.id === activeAnnotationId);
        if (!ann || ann.comment) return null;
        const isOthersAnn = !!(currentUserId && ann.creatorId && ann.creatorId !== currentUserId);
        if (isOthersAnn) return null;
        const markEl = containerRef.current?.querySelector<HTMLElement>(
          `[data-annotation-id="${activeAnnotationId}"]`
        );
        if (!markEl) return null;
        const markRect = markEl.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();
        return (
          <div
            className="absolute z-50 rounded-lg shadow-lg border px-3 py-2 hidden lg:flex items-center gap-2"
            style={{
              top: markRect.bottom - containerRect.top + 6,
              left: markRect.left - containerRect.left,
              background: "var(--card)",
              borderColor: "var(--border)",
              boxShadow: "0 4px 16px rgba(28,23,16,0.10)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setResizingAnnotationId(activeAnnotationId); setActiveAnnotationId(null); }}
              className="text-xs transition-opacity hover:opacity-60 cursor-pointer"
              style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
            >
              Resize
            </button>
            <span style={{ color: "var(--border)" }}>|</span>
            <button
              onClick={() => deleteAnnotation.mutate({ id: activeAnnotationId })}
              className="text-xs transition-opacity hover:opacity-60 cursor-pointer"
              style={{ color: "var(--danger)", fontFamily: "var(--font-geist-sans)" }}
            >
              Remove
            </button>
          </div>
        );
      })()}

      {/* Floating comment popover */}
      {pending && (
        <div
          className="absolute z-50 w-72 rounded-xl shadow-xl border overflow-hidden"
          style={{
            top: pending.rect.top,
            left: Math.min(pending.rect.left, (containerRef.current?.offsetWidth ?? 680) - 300),
            background: "var(--card)",
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
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {Object.entries(HIGHLIGHT_COLORS).map(([name, { active }]) => (
                  <button
                    key={name}
                    onClick={() => setSelectedColor(name)}
                    className="w-5 h-5 rounded-full transition-transform cursor-pointer"
                    style={{
                      background: active,
                      outline: selectedColor === name ? `2px solid ${active}` : "none",
                      outlineOffset: "2px",
                      transform: selectedColor === name ? "scale(1.15)" : "scale(1)",
                    }}
                    title={name}
                  />
                ))}
              </div>
              <button
                onClick={() => setSelectedVisibility((v) => v === "private" ? "public" : "private")}
                className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70 cursor-pointer shrink-0"
                style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
                title={selectedVisibility === "public" ? "Visible to everyone" : "Only visible to you"}
              >
                {selectedVisibility === "public" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M1.5 7h11M7 1.5c-1.5 1.5-2 3.5-2 5.5s.5 4 2 5.5M7 1.5c1.5 1.5 2 3.5 2 5.5s-.5 4-2 5.5" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 6V4.5a2 2 0 0 1 4 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
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
                if (e.key === "h" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveHighlightOnly(); }
                if (e.key === "Escape") cancelPending();
              }}
            />
            {saveError && (
              <p className="text-xs px-0.5" style={{ color: "var(--danger)", fontFamily: "var(--font-geist-sans)" }}>
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
                onClick={saveHighlightOnly}
                disabled={createAnnotation.isPending}
                className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                style={{
                  background: "var(--ink)",
                  color: "var(--cream)",
                  fontFamily: "var(--font-geist-sans)",
                  opacity: comment.trim() ? 0.5 : 1,
                }}
              >
                {createAnnotation.isPending ? "Saving…" : "Highlight only"}
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

      {/* Keyboard shortcuts button */}
      {!readOnly && <ShortcutsButton />}

      {/* Mobile: active annotation card */}
      {activeAnnotationId && (() => {
        const ann = displayAnnotations.find((a) => a.id === activeAnnotationId);
        if (!ann) return null;
        const isOthers = !!(currentUserId && ann.creatorId && ann.creatorId !== currentUserId);
        return (
          <MobileAnnotationCard
            annotation={ann}
            onClose={() => setActiveAnnotationId(null)}
            onDelete={readOnly || isOthers ? undefined : (id) => deleteAnnotation.mutate({ id })}
            onToggleVisibility={readOnly || isOthers ? undefined : toggleVisibility}
            onResize={readOnly || isOthers ? undefined : (id) => { setResizingAnnotationId(id); setActiveAnnotationId(null); }}
            isOthers={isOthers}
          />
        );
      })()}
    </div>
  );
}

// ─── Paragraph block with inline highlights ───────────────────────────────────

interface HighlightRange {
  annotationId: string;
  start: number;
  end: number;
  color: string;
  isOthers: boolean;
  edge: "start" | "end" | "both";
}

function ParagraphBlock({
  paragraph,
  highlights,
  activeAnnotationId,
  resizingAnnotationId,
  onHighlightClick,
  onHandleDragStart,
}: {
  paragraph: Paragraph;
  highlights: HighlightRange[];
  activeAnnotationId: string | null;
  resizingAnnotationId: string | null;
  onHighlightClick: (id: string) => void;
  onHandleDragStart: (annotationId: string, edge: "start" | "end") => void;
}) {
  const { type, text, id } = paragraph;

  const content = highlights.length > 0
    ? renderWithHighlights(text, highlights, activeAnnotationId, resizingAnnotationId, onHighlightClick, onHandleDragStart)
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

function DragHandle({ edge, onMouseDown }: {
  edge: "start" | "end";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      data-drag-handle
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onMouseDown(e); }}
      className="select-none"
      style={{
        position: "relative",
        display: "inline",
        width: 0,
        overflow: "visible",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "-2px",
          [edge === "start" ? "right" : "left"]: "-6px",
          width: "12px",
          height: "calc(1.2em + 4px)",
          borderRadius: "4px",
          cursor: "ew-resize",
          background: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        {/* Grip dots */}
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ pointerEvents: "none" }}>
          <circle cx="2" cy="2" r="1" fill="var(--cream)" opacity="0.7" />
          <circle cx="2" cy="5" r="1" fill="var(--cream)" opacity="0.7" />
          <circle cx="2" cy="8" r="1" fill="var(--cream)" opacity="0.7" />
          <circle cx="4.5" cy="2" r="1" fill="var(--cream)" opacity="0.7" />
          <circle cx="4.5" cy="5" r="1" fill="var(--cream)" opacity="0.7" />
          <circle cx="4.5" cy="8" r="1" fill="var(--cream)" opacity="0.7" />
        </svg>
      </span>
    </span>
  );
}

function renderWithHighlights(
  text: string,
  highlights: HighlightRange[],
  activeAnnotationId: string | null,
  resizingAnnotationId: string | null,
  onHighlightClick: (id: string) => void,
  onHandleDragStart: (annotationId: string, edge: "start" | "end") => void,
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
      const isPending = h.annotationId === "__pending__";
      const isActive = h.annotationId === activeAnnotationId;
      const isResizing = h.annotationId === resizingAnnotationId;
      const palette = HIGHLIGHT_COLORS[h.color] ?? HIGHLIGHT_COLORS.yellow;
      const showStartHandle = isResizing && (h.edge === "start" || h.edge === "both");
      const showEndHandle = isResizing && (h.edge === "end" || h.edge === "both");
      segments.push(
        <mark
          key={h.annotationId}
          data-annotation-id={h.annotationId}
          onClick={(e) => { if (!isPending) { e.stopPropagation(); onHighlightClick(h.annotationId); } }}
          className={isPending ? "rounded-sm" : "cursor-pointer rounded-sm transition-colors"}
          style={h.isOthers ? {
            background: "transparent",
            borderBottom: `2px dashed ${palette.dim}`,
            color: "var(--ink)",
            padding: "1px 0",
          } : {
            background: isPending ? palette.active : (isActive || isResizing) ? palette.active : palette.dim,
            color: "#1C1710",
            padding: "1px 1px",
          }}
        >
          {showStartHandle && (
            <DragHandle edge="start" onMouseDown={() => onHandleDragStart(h.annotationId, "start")} />
          )}
          {text.slice(start, end)}
          {showEndHandle && (
            <DragHandle edge="end" onMouseDown={() => onHandleDragStart(h.annotationId, "end")} />
          )}
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
  onToggleVisibility,
  onResize,
  readerRef,
  currentUserId,
}: {
  annotations: Annotation[];
  paragraphs: Paragraph[];
  activeAnnotationId: string | null;
  onSelect: (id: string | null) => void;
  onDelete?: (id: string) => void;
  onToggleVisibility?: (ann: Annotation) => void;
  onResize?: (id: string) => void;
  readerRef: React.RefObject<HTMLDivElement | null>;
  currentUserId?: string;
}) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [offsets, setOffsets] = useState<Record<string, number>>({});

  // Vertically align each card with its highlight in the article
  useLayoutEffect(() => {
    const newOffsets: Record<string, number> = {};
    let minTop = 0;

    // Resolve positions and sort by document order before stacking
    const positioned = annotations
      .map(ann => {
        const el = document.querySelector<HTMLElement>(`[data-paragraph-id="${ann.startParagraphId}"]`);
        return { ann, el, elTop: el ? getOffsetTopRelativeTo(el, readerRef.current) : 0 };
      })
      .sort((a, b) => a.elTop !== b.elTop ? a.elTop - b.elTop : a.ann.startOffset - b.ann.startOffset);

    for (const { ann, el, elTop } of positioned) {
      if (!el) continue;

      const top = Math.max(elTop, minTop);
      newOffsets[ann.id] = top;

      const cardHeight = cardRefs.current[ann.id]?.offsetHeight ?? 80;
      minTop = top + cardHeight + 12;
    }

    setOffsets(newOffsets);
  }, [annotations, readerRef]);

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
        const isOthers = !!(currentUserId && ann.creatorId && ann.creatorId !== currentUserId);
        return (
          <div
            key={ann.id}
            ref={(el) => { cardRefs.current[ann.id] = el; }}
            className="absolute w-full"
            style={{ top: offsets[ann.id] ?? 0 }}
          >
            <div
              onClick={(e) => { e.stopPropagation(); onSelect(isActive ? null : ann.id); }}
              className="rounded-lg p-3 cursor-pointer transition-all"
              style={{
                background: isOthers ? "var(--cream)" : "var(--card)",
                border: `1px solid ${isOthers ? "var(--ink-faint)" : "var(--border)"}`,
                borderStyle: isOthers ? "dashed" : "solid",
                boxShadow: isActive ? "0 2px 8px rgba(28,23,16,0.08)" : "none",
              }}
            >
              {isOthers && ann.creatorName && (
                <p
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
                >
                  {ann.creatorName}
                </p>
              )}
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}
              >
                {ann.comment}
              </p>
              {isActive && !isOthers && (
                <div className="flex items-center gap-3 mt-2">
                  {onResize && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResize(ann.id);
                      }}
                      className="text-xs transition-opacity hover:opacity-60 cursor-pointer"
                      style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
                    >
                      Resize
                    </button>
                  )}
                  {onToggleVisibility && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(ann);
                      }}
                      className="flex items-center gap-1 text-xs transition-opacity hover:opacity-60 cursor-pointer"
                      style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
                      title={ann.visibility === "public" ? "Public — click to make private" : "Private — click to make public"}
                    >
                      {ann.visibility === "public" ? (
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M1.5 7h11M7 1.5c-1.5 1.5-2 3.5-2 5.5s.5 4 2 5.5M7 1.5c1.5 1.5 2 3.5 2 5.5s-.5 4-2 5.5" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M5 6V4.5a2 2 0 0 1 4 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      )}
                      {ann.visibility === "public" ? "Public" : "Private"}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(ann.id);
                      }}
                      className="text-xs transition-opacity hover:opacity-60 cursor-pointer"
                      style={{ color: "var(--danger)", fontFamily: "var(--font-geist-sans)" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
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
  onToggleVisibility,
  onResize,
  isOthers,
}: {
  annotation: Annotation;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onToggleVisibility?: (ann: Annotation) => void;
  onResize?: (id: string) => void;
  isOthers?: boolean;
}) {
  if (!annotation) return null;
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-4">
      <div
        className="rounded-2xl p-4 shadow-2xl"
        style={{
          background: isOthers ? "var(--cream)" : "var(--card)",
          border: `1px ${isOthers ? "dashed" : "solid"} var(--border)`,
          boxShadow: "0 -4px 32px rgba(28,23,16,0.12)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            {isOthers && annotation.creatorName && (
              <p
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
              >
                {annotation.creatorName}
              </p>
            )}
            <p
              className="text-xs italic line-clamp-2"
              style={{ color: "var(--ink-muted)", fontFamily: "var(--font-lora)" }}
            >
              &ldquo;{annotation.highlightedText}&rdquo;
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 opacity-40 hover:opacity-70 transition-opacity cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {annotation.comment && (
          <p className="text-sm" style={{ color: "var(--ink)", fontFamily: "var(--font-geist-sans)" }}>
            {annotation.comment}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3">
          {onResize && (
            <button
              onClick={() => onResize(annotation.id)}
              className="text-xs transition-opacity hover:opacity-60 cursor-pointer"
              style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
            >
              Resize
            </button>
          )}
          {onToggleVisibility && (
            <button
              onClick={() => onToggleVisibility(annotation)}
              className="flex items-center gap-1 text-xs transition-opacity hover:opacity-60 cursor-pointer"
              style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
            >
              {annotation.visibility === "public" ? "Public" : "Private"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(annotation.id)}
              className="text-xs transition-opacity hover:opacity-60 cursor-pointer"
              style={{ color: "var(--danger)", fontFamily: "var(--font-geist-sans)" }}
            >
              Delete
            </button>
          )}
        </div>
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

function getHighlightedText(
  paragraphs: Paragraph[],
  startParagraphId: string,
  startOffset: number,
  endParagraphId: string,
  endOffset: number,
): string {
  if (startParagraphId === endParagraphId) {
    const p = paragraphs.find((p) => p.id === startParagraphId);
    return p ? p.text.slice(startOffset, endOffset) : "";
  }
  const startIdx = paragraphs.findIndex((p) => p.id === startParagraphId);
  const endIdx = paragraphs.findIndex((p) => p.id === endParagraphId);
  let text = paragraphs[startIdx]?.text.slice(startOffset) ?? "";
  for (let i = startIdx + 1; i < endIdx; i++) {
    text += " " + paragraphs[i].text;
  }
  text += " " + (paragraphs[endIdx]?.text.slice(0, endOffset) ?? "");
  return text;
}

function getOffsetTopRelativeTo(el: HTMLElement, ancestor: HTMLElement | null): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

function ShortcutsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl+";

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const shortcuts = [
    { keys: `${mod}H`, label: "Highlight only" },
    { keys: `${mod}↵`, label: "Save with comment" },
    { keys: "Esc", label: "Cancel / deselect" },
    { keys: "J / K", label: "Navigate highlights" },
  ];

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-40">
      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 rounded-xl p-3 shadow-xl border min-w-[200px]"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            boxShadow: "0 8px 32px rgba(28,23,16,0.14)",
          }}
        >
          <p
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-geist-sans)" }}
          >
            Keyboard shortcuts
          </p>
          <div className="flex flex-col gap-1.5">
            {shortcuts.map((s) => (
              <div key={s.keys} className="flex items-center justify-between gap-4">
                <span
                  className="text-xs"
                  style={{ color: "var(--ink-muted)", fontFamily: "var(--font-geist-sans)" }}
                >
                  {s.label}
                </span>
                <kbd
                  className="text-[11px] px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--border)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-geist-sans)",
                  }}
                >
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70 cursor-pointer"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--ink-muted)",
          boxShadow: "0 2px 8px rgba(28,23,16,0.08)",
        }}
        title="Keyboard shortcuts"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="4" width="13" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4 7h1M7 7h2M11 7h1M4 9.5h1M6 9.5h4M11 9.5h1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function buildHighlightMap(annotations: Annotation[], currentUserId?: string): Record<string, HighlightRange[]> {
  const map: Record<string, HighlightRange[]> = {};
  for (const ann of annotations) {
    const isOthers = !!(currentUserId && ann.creatorId && ann.creatorId !== currentUserId);
    // For same-paragraph highlights
    if (ann.startParagraphId === ann.endParagraphId) {
      if (!map[ann.startParagraphId]) map[ann.startParagraphId] = [];
      map[ann.startParagraphId].push({
        annotationId: ann.id,
        start: ann.startOffset,
        end: ann.endOffset,
        color: ann.color,
        isOthers,
        edge: "both",
      });
    } else {
      // Cross-paragraph: highlight to end of start paragraph, from start of end paragraph
      if (!map[ann.startParagraphId]) map[ann.startParagraphId] = [];
      map[ann.startParagraphId].push({
        annotationId: ann.id,
        start: ann.startOffset,
        end: Infinity,
        color: ann.color,
        isOthers,
        edge: "start",
      });
      if (!map[ann.endParagraphId]) map[ann.endParagraphId] = [];
      map[ann.endParagraphId].push({
        annotationId: ann.id,
        start: 0,
        end: ann.endOffset,
        color: ann.color,
        isOthers,
        edge: "end",
      });
    }
  }
  return map;
}
