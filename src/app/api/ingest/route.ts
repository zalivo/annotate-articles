import { NextRequest, NextResponse } from "next/server";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type Paragraph } from "@/db/schema";
import { createServerClient } from "@supabase/ssr";
import dns from "dns/promises";
import net from "net";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

function isPrivateIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === "::1" || ip === "::ffff:127.0.0.1") return true;

  // Normalize IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;

  if (net.isIPv4(v4)) {
    const parts = v4.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 10 ||                          // 10.0.0.0/8
      a === 127 ||                         // 127.0.0.0/8 (loopback)
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||          // 192.168.0.0/16
      (a === 169 && b === 254) ||          // 169.254.0.0/16 (link-local / cloud metadata)
      a === 0                              // 0.0.0.0/8
    );
  }

  // IPv6 private ranges
  if (net.isIPv6(ip)) {
    return (
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe80") ||
      ip === "::"
    );
  }

  return false;
}

async function validatePublicUrl(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "Invalid URL.";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http and https URLs are allowed.";
  }

  const hostname = parsed.hostname;

  // Reject bare IP addresses directly in the URL
  if (net.isIP(hostname) !== 0) {
    if (isPrivateIP(hostname)) return "Private IP addresses are not allowed.";
    return null; // public IP in URL — fine
  }

  // Resolve hostname and check all returned IPs
  let addresses: string[];
  try {
    addresses = (await dns.resolve(hostname)).flat();
  } catch {
    return "Could not resolve hostname.";
  }

  for (const addr of addresses) {
    if (isPrivateIP(addr)) return "URL resolves to a private network address.";
  }

  return null; // all good
}

export async function POST(req: NextRequest) {
  // Require authentication
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to ingest articles." }, { status: 401 });
  }

  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // SSRF protection
  const ssrfError = await validatePublicUrl(url);
  if (ssrfError) {
    return NextResponse.json({ error: ssrfError }, { status: 422 });
  }

  // Check for existing article
  const [existing] = await db
    .select()
    .from(articles)
    .where(eq(articles.sourceUrl, url))
    .limit(1);

  if (existing) return NextResponse.json(existing);

  // Fetch the page with a 5 MB cap
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HighlightStack/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        reader.cancel();
        throw new Error("Response too large (> 5 MB)");
      }
      chunks.push(value);
    }

    html = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.length + chunk.length);
        merged.set(acc);
        merged.set(chunk, acc.length);
        return merged;
      }, new Uint8Array())
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to fetch article: ${(e as Error).message}` },
      { status: 422 }
    );
  }

  // Parse with Readability
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();

  if (!parsed || !parsed.content || parsed.content.length < 200) {
    return NextResponse.json(
      { error: "Could not extract article content. The page may be paywalled or JS-rendered." },
      { status: 422 }
    );
  }

  // Parse content into structured paragraphs
  const contentDom = new JSDOM(parsed.content);
  const blockElements = contentDom.window.document.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, blockquote, li"
  );

  const paragraphs: Paragraph[] = [];
  let idx = 0;
  blockElements.forEach((el) => {
    const text = el.textContent?.trim() ?? "";
    if (!text) return;
    paragraphs.push({
      id: `p-${idx++}`,
      text,
      html: el.innerHTML,
      type: el.tagName.toLowerCase() as Paragraph["type"],
    });
  });

  if (paragraphs.length === 0) {
    return NextResponse.json(
      { error: "No readable paragraphs found." },
      { status: 422 }
    );
  }

  const [article] = await db
    .insert(articles)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .values({
      sourceUrl: url,
      title: parsed.title,
      author: parsed.byline ?? undefined,
      siteName: parsed.siteName ?? undefined,
      paragraphs,
    } as any)
    .returning();

  return NextResponse.json(article);
}
