// يحوّل روابط يوتيوب المعتادة (watch?v=, youtu.be, shorts) إلى رابط embed قابل للعرض داخل iframe
export function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    let id: string | null = null;
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1);
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url; // رابط embed جاهز أصلًا
      if (u.pathname.startsWith("/shorts/")) {
        id = u.pathname.split("/shorts/")[1];
      } else {
        id = u.searchParams.get("v");
      }
    }
    if (!id) return null;
    id = id.split("&")[0].split("?")[0];
    return `https://www.youtube.com/embed/${id}`;
  } catch {
    return null;
  }
}

// يحوّل رابط مشاركة Google Drive العادي إلى رابط preview قابل للعرض داخل iframe
export function getDriveEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("drive.google.com") && !u.hostname.includes("docs.google.com")) {
      return null;
    }
    if (u.pathname.includes("/preview")) return url; // رابط preview جاهز أصلًا
    const match = u.pathname.match(/\/d\/([^/]+)/);
    const id = match?.[1] ?? u.searchParams.get("id");
    if (!id) return null;
    return `https://drive.google.com/file/d/${id}/preview`;
  } catch {
    return null;
  }
}
