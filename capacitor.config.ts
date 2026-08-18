import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.englishhub.app',
  appName: 'English Hub',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      // نفس القناة المستخدمة في AndroidManifest.xml (default_notification_channel_id)
      // ونفس الأيقونة/اللون المولّدين في android-assets/notification-icon
      smallIcon: "ic_stat_notify",
      iconColor: "#0A5968",
      sound: "default",
    },
  },
};

export default config;
