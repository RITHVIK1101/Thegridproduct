export default {
  expo: {
    name: "GridlyApp",
    slug: "GridlyApp",
    owner: "rithvik1101", // Updated owner: change this to the desired Expo username or team name.
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.jpg",
    userInterfaceStyle: "light",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#000000",
    },
    extra: {
      NGROK_URL: "https://de17-71-197-245-145.ngrok-free.app",
      // Removed the old "eas" field with projectId to allow re-linking under the new owner.
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "Gridly needs access to your photo library to allow you to upload images when creating service listings. These images will be publicly visible to potential customers browsing your offerings.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000",
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
  },
};
