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

const STORAGE_KEY = "elh_workspace_stage_id";

interface WorkspaceContextValue {
  stages: (Stage & { id: string })[];
  stageId: string | null;
  stageName: string | null;
  setStageId: (id: string | null) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  stages: [],
  stageId: null,
  stageName: null,
  setStageId: () => {},
  loading: true,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [stageId, setStageIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setStageIdState(saved);
    const unsub = listenCollection<Stage>("stages", [orderBy("order")], (list) => {
      setStages(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const setStageId = (id: string | null) => {
    setStageIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  };

  const stageName = stages.find((s) => s.id === stageId)?.name ?? null;

  return (
    <WorkspaceContext.Provider value={{ stages, stageId, stageName, setStageId, loading }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
