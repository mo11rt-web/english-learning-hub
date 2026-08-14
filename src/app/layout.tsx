import type { Metadata, Viewport } from "next";
// TEMP disabled for sandbox test
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ThemeProvider } from "@/hooks/useTheme";
import { GlobalErrorToast } from "@/components/GlobalErrorToast";

const cairo = { variable: "" };
const inter = { variable: "" };

export const metadata: Metadata = {
  title: "Learn English | with Mohanad Allawi",
  description: "تعلّم. احترف. انجح. — منصة الأستاذ مهند علاوي لتعليم اللغة الإنجليزية",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Learn English",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#093A42",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${inter.variable}`}>
      <head>
        {/* تطبيق الوضع الداكن/الفاتح فورًا قبل أول رسم للصفحة، لتفادي "ومضة"
            الوضع الخاطئ قبل ما يتحمّل React */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('elh_theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}`,
          }}
        />
        {/* التقاط حدث تثبيت التطبيق (PWA) بأبكر وقت ممكن، قبل ما React
            يشتغل، حتى ما يفوتنا الحدث إذا صار بدري */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__pwaInstallEvent=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallEvent=e;window.dispatchEvent(new Event('pwa-install-ready'));});`,
          }}
        />
      </head>
      <body className="font-arabic bg-app-gradient bg-geo-pattern min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>{children}</WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
        <GlobalErrorToast />
      </body>
    </html>
  );
}
