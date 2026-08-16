import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Renders an off-screen HTML element (already styled with our Arabic font +
 * RTL layout) into a real PDF file. We deliberately don't use jsPDF's text
 * APIs directly — jsPDF ships no Arabic glyphs and can't shape Arabic script,
 * so text-based PDF generation would come out as boxes/garbage. Rendering
 * through the browser's own text engine (via html2canvas) is what actually
 * produces correct Arabic output.
 */
export async function exportHtmlToPdf(element: HTMLElement, filename: string): Promise<File> {
  const canvas = await html2canvas(element, {
    // القالب نفسه بحجم A4 تقريباً؛ دقة 1.25 كافية للنص العربي وتقلل حجم الملف مقارنةً بـ PNG وscale=2.
    scale: 1.25,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    imageTimeout: 0,
  });

  // JPEG مضغوط أصغر بكثير من PNG، مع بقاء الخطوط والعناصر الملونة واضحة للطباعة والمشاركة.
  const imgData = canvas.toDataURL("image/jpeg", 0.78);
  const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
  const imageWidth = canvas.width * scale;
  const imageHeight = canvas.height * scale;
  const offsetX = (pageWidth - imageWidth) / 2;
  const offsetY = (pageHeight - imageHeight) / 2;
  pdf.addImage(imgData, "JPEG", offsetX, offsetY, imageWidth, imageHeight, undefined, "FAST");

  const blob = pdf.output("blob");
  return new File([blob], filename, { type: "application/pdf" });
}

/**
 * Downloads the PDF directly on desktop/web browsers. On phones (mobile
 * browser or the native Android app), uses the native share sheet instead —
 * that's the platform-native way to let someone pick "Save to Files",
 * "Share", etc. Desktop browsers that technically support the Web Share
 * API would otherwise pop the OS share sheet instead of just downloading
 * the file, which isn't what people expect on a computer.
 */
export async function downloadOrShareFile(file: File) {
  const isMobile =
    typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  let canShareFiles = false;
  if (isMobile) {
    try {
      // `canShare` existing doesn't guarantee it won't throw for a given
      // file — on some browsers calling it (or `share` itself) with a PDF
      // throws synchronously instead of just returning false, which would
      // otherwise skip the try/catch below entirely and abort the whole
      // download with no visible error.
      canShareFiles =
        "canShare" in navigator && !!(navigator as any).canShare?.({ files: [file] });
    } catch {
      canShareFiles = false;
    }
  }

  if (canShareFiles) {
    try {
      await (navigator as any).share({ files: [file], title: file.name });
      return;
    } catch {
      // user cancelled, or sharing isn't actually usable here — fall back to a normal download
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  // Some desktop browsers (older Firefox/Safari builds in particular)
  // silently ignore `.click()` on an <a> that was never attached to the
  // document — this was likely why downloads "did nothing" on computer
  // while working fine on mobile (which mostly took the share() path
  // above instead). Attaching it, and only removing it/revoking the blob
  // URL a moment later, makes the download reliably fire everywhere.
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
