// يحاول إضافة https:// تلقائيًا إذا نسي المستخدم يكتبها عند لصق الرابط
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// يحوّل روابط يوتيوب المعتادة (watch?v=, youtu.be, shorts, live, m.youtube, music.youtube)
// إلى رابط embed قابل للعرض داخل iframe
export function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(normalizeUrl(url));
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "").replace(/^music\./, "");
    let id: string | null = null;

    if (host === "youtu.be") {
      id = u.pathname.slice(1);
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname.startsWith("/embed/")) return normalizeUrl(url); // رابط embed جاهز أصلًا
      if (u.pathname.startsWith("/shorts/")) {
        id = u.pathname.split("/shorts/")[1];
      } else if (u.pathname.startsWith("/live/")) {
        id = u.pathname.split("/live/")[1];
      } else {
        id = u.searchParams.get("v");
      }
    } else {
      return null;
    }

    if (!id) return null;
    id = id.split("&")[0].split("?")[0].split("/")[0];
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}`;
  } catch {
    return null;
  }
}

// يحوّل رابط مشاركة Google Drive العادي (أو رابط uc?id=) إلى رابط preview قابل للعرض داخل iframe
export function getDriveEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(normalizeUrl(url));
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes("drive.google.com") && !host.includes("docs.google.com")) {
      return null;
    }
    if (u.pathname.includes("/preview")) return normalizeUrl(url); // رابط preview جاهز أصلًا
    const match = u.pathname.match(/\/d\/([^/]+)/);
    const id = match?.[1] ?? u.searchParams.get("id");
    if (!id) return null;
    return `https://drive.google.com/file/d/${id}/preview`;
  } catch {
    return null;
  }
}

// يكتشف نوع رابط الفيديو (يوتيوب أو Google Drive) — تُستخدم قبل حفظ الدرس
// حتى تُصنَّف كتلة الفيديو بالنوع الصحيح ولا يبقى الرابط بدون مشغّل داخل التطبيق
export function detectVideoType(url: string): "youtube" | "google-drive" | null {
  if (!url.trim()) return null;
  if (getYoutubeEmbedUrl(url)) return "youtube";
  if (getDriveEmbedUrl(url)) return "google-drive";
  return null;
}
