"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { orderBy } from "@/lib/firestore-helpers";
import { listenCollection } from "@/lib/firestore-helpers";
import { Stage } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "elh_workspace_stage_id";

interface WorkspaceContextValue {
  stages: (Stage & { id: string })[];
  stageId: string | null;
  stageName: string | null;
  setStageId: (id: string | null) => void;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  stages: [],
  stageId: null,
  stageName: null,
  setStageId: () => {},
  loading: true,
  error: null,
  retry: () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [stageId, setStageIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // يتغيّر كل مرة نطلب فيها إعادة المحاولة يدويًا، وبما إنه ضمن deps الأثر
  // تحته، تغييره يعيد تشغيل الاستماع من جديد بدون أي منطق إضافي
  const [retryTick, setRetryTick] = useState(0);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError(null);
      setStages([]);
      return;
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setStageIdState(saved);
    setLoading(true);
    setError(null);
    const unsub = listenCollection<Stage>(
      "stages",
      [orderBy("order")],
      (list) => {
        setStages(list);
        setLoading(false);
        setError(null);
      },
      // بدون هذا المعالج، أي خطأ (شبكة، صلاحيات، إلخ) كان يختفي بصمت
      // ويترك "loading" عالقة true للأبد — شاشة "جاري التحميل" لا تنتهي
      // أبدًا. هلق أي خطأ ينهي حالة التحميل فورًا ويظهر رسالة واضحة
      // مع خيار إعادة المحاولة، بدل التعليق الصامت.
      (err) => {
        setLoading(false);
        setError(
          err.message?.includes("permission")
            ? "لا توجد صلاحية لعرض الأقسام. جرّب تسجيل الخروج والدخول مجددًا."
            : "تعذر تحميل الأقسام. تحقق من الاتصال بالإنترنت."
        );
      }
    );
    return () => unsub();
  }, [retryTick, user, authLoading]);

  const retry = () => setRetryTick((n) => n + 1);

  const setStageId = (id: string | null) => {
    setStageIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  };

  const stageName = stages.find((s) => s.id === stageId)?.name ?? null;

  return (
    <WorkspaceContext.Provider value={{ stages, stageId, stageName, setStageId, loading, error, retry }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
