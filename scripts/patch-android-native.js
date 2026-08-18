#!/usr/bin/env node
/**
 * scripts/patch-android-native.js
 * ------------------------------------------------------------------
 * يُشغَّل مرة واحدة بعد "npx cap add android" (أو "npx cap sync android"
 * إن كان مجلد android موجوداً مسبقاً) ليضبط:
 *   1) android/app/src/main/AndroidManifest.xml
 *        -> صلاحيات INTERNET / WAKE_LOCK / POST_NOTIFICATIONS
 *   2) android/build.gradle
 *        -> classpath com.google.gms:google-services (لازم لقراءة google-services.json)
 *   3) android/app/build.gradle
 *        -> apply plugin: com.google.gms.google-services
 * كل خطوة idempotent (آمنة عند تكرار التشغيل، ما تكرر السطر لو موجود أصلاً).
 * ------------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "android/app/src/main/AndroidManifest.xml");
const PROJECT_GRADLE = path.join(ROOT, "android/build.gradle");
const APP_GRADLE = path.join(ROOT, "android/app/build.gradle");
const RES_DIR = path.join(ROOT, "android/app/src/main/res");
const COLORS_XML = path.join(RES_DIR, "values/colors.xml");
const ICON_SOURCE_DIR = path.join(ROOT, "android-assets/notification-icon");

const CHANNEL_ID = "engagement_channel";
const NOTIFICATION_COLOR_NAME = "notification_icon_color";
const NOTIFICATION_COLOR_VALUE = "#0A5968";

const REQUIRED_PERMISSIONS = [
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
];

// meta-data تخبر Firebase Messaging أي أيقونة/لون/قناة يستخدم تلقائياً
// عندما يوصل إشعار والتطبيق بالخلفية أو مقفول (لا يمر عبر كود جافاسكريبت أصلاً)
const FCM_META_DATA = [
  `<meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notify" />`,
  `<meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/${NOTIFICATION_COLOR_NAME}" />`,
  `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="${CHANNEL_ID}" />`,
];

const GOOGLE_SERVICES_CLASSPATH = 'classpath "com.google.gms:google-services:4.4.2"';
const GOOGLE_SERVICES_PLUGIN = "apply plugin: 'com.google.gms.google-services'";

function fail(msg) {
  console.error(`[patch-android-native] ${msg}`);
  process.exit(1);
}

function patchManifest() {
  if (!fs.existsSync(MANIFEST)) fail(`AndroidManifest.xml not found at ${MANIFEST}. Run "npx cap add android" first.`);
  let xml = fs.readFileSync(MANIFEST, "utf8");

  const missing = REQUIRED_PERMISSIONS.filter((p) => !xml.includes(p.match(/android:name="([^"]+)"/)[1]));
  if (missing.length === 0) {
    console.log("[patch-android-native] AndroidManifest.xml already has all required permissions.");
    return;
  }

  const insertion = missing.map((p) => "    " + p).join("\n") + "\n";
  xml = xml.replace(/(<manifest[^>]*>\n)/, `$1${insertion}`);
  fs.writeFileSync(MANIFEST, xml, "utf8");
  console.log(`[patch-android-native] added ${missing.length} permission(s) to AndroidManifest.xml`);
}

function patchManifestFcmMetaData() {
  let xml = fs.readFileSync(MANIFEST, "utf8");

  const missing = FCM_META_DATA.filter((m) => {
    const nameMatch = m.match(/android:name="([^"]+)"/)[1];
    return !xml.includes(nameMatch);
  });
  if (missing.length === 0) {
    console.log("[patch-android-native] FCM default notification meta-data already present.");
    return;
  }

  const insertion = missing.map((m) => "        " + m).join("\n") + "\n";
  // نضيفها قبل إغلاق أول <application ...> ... </application>
  xml = xml.replace(/(<\/application>)/, `${insertion}    $1`);
  fs.writeFileSync(MANIFEST, xml, "utf8");
  console.log(`[patch-android-native] added ${missing.length} FCM meta-data entr(y/ies) to AndroidManifest.xml`);
}

function patchColorsXml() {
  if (!fs.existsSync(path.dirname(COLORS_XML))) fs.mkdirSync(path.dirname(COLORS_XML), { recursive: true });

  let xml = fs.existsSync(COLORS_XML)
    ? fs.readFileSync(COLORS_XML, "utf8")
    : `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n`;

  if (xml.includes(`name="${NOTIFICATION_COLOR_NAME}"`)) {
    console.log("[patch-android-native] notification_icon_color already present in colors.xml.");
    return;
  }

  xml = xml.replace(
    /<\/resources>/,
    `    <color name="${NOTIFICATION_COLOR_NAME}">${NOTIFICATION_COLOR_VALUE}</color>\n</resources>`
  );
  fs.writeFileSync(COLORS_XML, xml, "utf8");
  console.log("[patch-android-native] added notification_icon_color to colors.xml");
}

function copyNotificationIcons() {
  if (!fs.existsSync(ICON_SOURCE_DIR)) fail(`Icon source folder not found: ${ICON_SOURCE_DIR}`);

  const densityFolders = fs
    .readdirSync(ICON_SOURCE_DIR)
    .filter((f) => f.startsWith("drawable-") && fs.statSync(path.join(ICON_SOURCE_DIR, f)).isDirectory());

  for (const folder of densityFolders) {
    const srcFile = path.join(ICON_SOURCE_DIR, folder, "ic_stat_notify.png");
    if (!fs.existsSync(srcFile)) continue;

    const destDir = path.join(RES_DIR, folder);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcFile, path.join(destDir, "ic_stat_notify.png"));
  }
  console.log(`[patch-android-native] copied notification icon into ${densityFolders.length} density folder(s)`);
}

function patchProjectGradle() {
  if (!fs.existsSync(PROJECT_GRADLE)) fail(`android/build.gradle not found. Run "npx cap add android" first.`);
  let gradle = fs.readFileSync(PROJECT_GRADLE, "utf8");

  if (gradle.includes("com.google.gms:google-services")) {
    console.log("[patch-android-native] google-services classpath already present.");
    return;
  }

  gradle = gradle.replace(
    /dependencies\s*{/,
    `dependencies {\n        ${GOOGLE_SERVICES_CLASSPATH}`
  );
  fs.writeFileSync(PROJECT_GRADLE, gradle, "utf8");
  console.log("[patch-android-native] added google-services classpath to android/build.gradle");
}

function patchAppGradle() {
  if (!fs.existsSync(APP_GRADLE)) fail(`android/app/build.gradle not found. Run "npx cap add android" first.`);
  let gradle = fs.readFileSync(APP_GRADLE, "utf8");

  if (gradle.includes("com.google.gms.google-services")) {
    console.log("[patch-android-native] google-services plugin already applied.");
    return;
  }

  gradle = gradle.trimEnd() + `\n\n${GOOGLE_SERVICES_PLUGIN}\n`;
  fs.writeFileSync(APP_GRADLE, gradle, "utf8");
  console.log("[patch-android-native] applied google-services plugin in android/app/build.gradle");
}

patchManifest();
patchManifestFcmMetaData();
patchColorsXml();
copyNotificationIcons();
patchProjectGradle();
patchAppGradle();
console.log("[patch-android-native] done.");
