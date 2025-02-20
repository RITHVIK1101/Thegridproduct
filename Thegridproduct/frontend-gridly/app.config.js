import 'dotenv/config';

export default {
  expo: {
    name: "The Gridly",
    slug: "your-app-slug",
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
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gridly.mobile",
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Gridly requires access to your photos so you can upload images for your service listings, helping potential customers view your products or services."
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
      NGROK_URL: process.env.NGROK_URL,
      eas: {
        projectId: "0f8792ae-5411-4193-898e-8a69005c50e7"
      }
    },
  },
};
