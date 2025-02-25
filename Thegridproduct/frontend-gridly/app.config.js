import 'dotenv/config';

export default {
  expo: {
    name: "The Gridly",
    slug: "your-app-slug",
    owner: "rithvik1101", // 👈 Add your Expo username here
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.jpg",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gridly.mobile",
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Gridly needs access to your photo library to allow you to upload images when creating service listings. These images will be publicly visible to potential customers browsing your offerings.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      NGROK_URL: process.env.NGROK_URL
      // 🚀 Removed the old "eas.projectId" to unlink the previous project
    }
  }
};
