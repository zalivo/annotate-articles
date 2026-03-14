import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") ?? "Highlight Stack";
  const subtitle = searchParams.get("subtitle") ?? "";
  const type = searchParams.get("type") ?? "default"; // default | article | stack | shared

  const label =
    type === "article"
      ? "Article"
      : type === "stack"
        ? "Stack"
        : type === "shared"
          ? "Shared Highlights"
          : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#F7F3EC",
          fontFamily: "serif",
        }}
      >
        {/* Top label */}
        {label && (
          <div
            style={{
              fontSize: 20,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#6B6357",
              marginBottom: 24,
            }}
          >
            {label}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 60 ? 44 : 56,
            color: "#1C1710",
            lineHeight: 1.2,
            maxWidth: "90%",
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: 24,
              color: "#6B6357",
              marginTop: 20,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Bottom branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "absolute",
            bottom: 60,
            left: 80,
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "#1C1710",
              letterSpacing: "0.05em",
            }}
          >
            HIGH
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#1C1710",
              fontStyle: "italic",
              background: "#F5C842",
              padding: "2px 8px",
            }}
          >
            LIGHT
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#1C1710",
              letterSpacing: "0.05em",
            }}
          >
            STACK
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
