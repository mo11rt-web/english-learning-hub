export function getYoutubeEmbedUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const raw = url.trim();
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(candidate);
    const hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | null = null;

    if (hostname === "youtu.be") {
      id = u.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtube-nocookie.com") {
      if (u.pathname.startsWith("/embed/")) {
        id = u.pathname.split("/embed/")[1]?.split("/")[0] ?? null;
      } else if (u.pathname.startsWith("/shorts/")) {
        id = u.pathname.split("/shorts/")[1]?.split("/")[0] ?? null;
      } else {
        id = u.searchParams.get("v");
      }
    }

    if (!id) return null;
    id = id.trim().split("&")[0].split("?")[0];
    if (!id) return null;
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  } catch {
    return null;
  }
}

// يحوّل رابط مشاركة Google Drive العادي إلى رابط preview قابل للعرض داخل iframe
export function getDriveEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const raw = url.trim();
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(candidate);
    if (!u.hostname.includes("drive.google.com") && !u.hostname.includes("docs.google.com")) {
      return null;
    }
    if (u.pathname.includes("/preview")) return candidate;
    const match = u.pathname.match(/\/d\/([^/]+)/);
    const id = match?.[1] ?? u.searchParams.get("id");
    if (!id) return null;
    return `https://drive.google.com/file/d/${id}/preview`;
  } catch {
    return null;
  }
}
