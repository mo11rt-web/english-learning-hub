import { LessonBlock } from "@/lib/types";
import { SpeakButton } from "@/components/SpeakButton";
import { getYoutubeEmbedUrl, getDriveEmbedUrl } from "@/lib/embed";

function isPdfUrl(url: string) {
  return /\.pdf(\?|#|$)/i.test(url) || url.includes("application/pdf");
}

export function LessonBlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-xl font-bold text-brand-text">{block.content}</h2>;
    case "subheading":
      return <h3 className="text-lg font-semibold text-brand-text">{block.content}</h3>;
    case "paragraph-ar":
      return <p dir="rtl" className="text-brand-text leading-relaxed">{block.content}</p>;
    case "paragraph-en":
      return (
        <div className="flex items-start gap-3">
          <p dir="ltr" className="text-brand-text leading-relaxed flex-1">{block.content}</p>
          <SpeakButton text={block.content} size="sm" />
        </div>
      );
    case "bilingual":
      return <p className="text-brand-text leading-relaxed whitespace-pre-wrap">{block.content}</p>;
    case "vocabulary-word":
      return (
        <div className="flex items-center gap-3">
          <p dir="ltr" className="text-2xl font-bold text-brand-primary">{block.content}</p>
          <SpeakButton text={block.content} />
        </div>
      );
    case "note":
      return <p className="text-brand-text bg-brand-primary/5 rounded-xl p-3">💡 {block.content}</p>;
    case "alert":
      return <p className="text-brand-error bg-brand-error/10 rounded-xl p-3">⚠️ {block.content}</p>;
    case "rule":
      return <p className="text-brand-text bg-brand-success/10 rounded-xl p-3">📏 {block.content}</p>;
    case "example":
      return <p dir="ltr" className="text-brand-text italic bg-brand-secondary/10 rounded-xl p-3">✏️ {block.content}</p>;

    case "image":
      return block.content ? (
        <img src={block.content} alt="" className="rounded-xl max-w-full mx-auto" loading="lazy" />
      ) : (
        <p className="text-brand-textMuted text-sm">لا توجد صورة بعد</p>
      );

    case "audio":
      return block.content ? (
        <audio controls src={block.content} className="w-full" />
      ) : (
        <p className="text-brand-textMuted text-sm">لا يوجد تسجيل صوتي بعد</p>
      );

    case "pdf":
      return block.content ? (
        <div className="flex flex-col gap-2">
          <iframe
            src={block.content}
            className="w-full h-[70vh] rounded-xl border border-brand-primary/15"
            title="PDF"
          />
          <a
            href={block.content}
            target="_blank"
            rel="noreferrer"
            className="text-brand-primary text-xs self-start"
          >
            فتح الملف بنافذة كاملة ↗
          </a>
        </div>
      ) : (
        <p className="text-brand-textMuted text-sm">لا يوجد ملف PDF بعد</p>
      );

    case "book-page":
      if (!block.content) return <p className="text-brand-textMuted text-sm">لا توجد صفحة بعد</p>;
      return isPdfUrl(block.content) ? (
        <iframe
          src={block.content}
          className="w-full h-[80vh] rounded-xl border border-brand-primary/15"
          title="صفحة الكتاب"
        />
      ) : (
        <img src={block.content} alt="صفحة من الكتاب" className="rounded-xl max-w-full mx-auto" loading="lazy" />
      );

    case "youtube": {
      const embed = getYoutubeEmbedUrl(block.content);
      if (!embed) return <p className="text-brand-error text-sm">رابط يوتيوب غير صالح</p>;
      return (
        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: "56.25%" }}>
          <iframe
            src={embed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            title="YouTube video"
          />
        </div>
      );
    }

    case "google-drive": {
      const embed = getDriveEmbedUrl(block.content);
      if (!embed) return <p className="text-brand-error text-sm">رابط Google Drive غير صالح</p>;
      return (
        <iframe
          src={embed}
          className="w-full h-[70vh] rounded-xl border border-brand-primary/15"
          allow="autoplay"
          title="Google Drive preview"
        />
      );
    }

    default:
      return <p className="text-brand-text whitespace-pre-wrap">{block.content}</p>;
  }
}
