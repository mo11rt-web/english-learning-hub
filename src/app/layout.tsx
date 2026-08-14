import type { Metadata, Viewport } from "next";
import { Cairo, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ThemeProvider } from "@/hooks/useTheme";
import { GlobalErrorToast } from "@/components/GlobalErrorToast";

// نفس عائلة الخط المستخدمة في تطبيق "علاوي نت" (Cairo للنصوص العربية،
// Space Grotesk كخط مساعد للأرقام/النصوص الإنجليزية القصيرة).
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-arabic",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-english",
  display: "swap",
});

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
  themeColor: "#43541F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${spaceGrotesk.variable}`}>
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
