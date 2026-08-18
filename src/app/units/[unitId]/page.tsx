import { Suspense } from "react";
import PageContent from "./PageContent";

// output:"export" (Capacitor) يحتاج generateStaticParams لكل route ديناميكي.
// المحتوى الحقيقي (unitId) بينمرّر لاحقاً عبر query string وليس عبر الـ path
// (شوف src/lib/routes.ts) لأن الدروس/الوحدات/الواجبات بتتغيّر باستمرار وما
// فينا نعرف كل الـ IDs الحقيقية وقت البناء.
export async function generateStaticParams() {
  return [{ unitId: "static" }];
}

export const dynamicParams = false;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}
