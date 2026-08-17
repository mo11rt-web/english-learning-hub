"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, signOut as fbSignOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Profile } from "@/lib/types";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  error: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setError("إعدادات Firebase غير مكتملة. أضف متغيرات NEXT_PUBLIC_FIREBASE_* ثم أعد تشغيل التطبيق.");
      return;
    }
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setError(null);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsubProfile = onSnapshot(
      doc(db, "profiles", user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as Profile) : null);
        setLoading(false);
        setError(null);
      },
      // بدون هذا، أي خطأ لحظي بقراءة الملف الشخصي (شبكة بطيئة، صلاحيات لسا
      // ما تزامنت) كان يترك "loading" عالقة true للأبد — يعني شاشة "جاري
      // التحميل" لا تختفي أبدًا بعد تسجيل الدخول مباشرة.
      (err) => {
        console.error("[useAuth:profile]", err);
        setLoading(false);
        setError("تعذر تحميل بيانات الحساب. تحقق من الاتصال وأعد المحاولة.");
      }
    );
    return () => unsubProfile();
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        signOut: async () => {
          if (auth) await fbSignOut(auth);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
