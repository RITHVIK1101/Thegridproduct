// firebaseConfig.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyATf4Ts4_hJyLKn9AZSxtF8vpVpQqQftz4",
  authDomain: "the-gridly.firebaseapp.com",
  projectId: "the-gridly",
  storageBucket: "the-gridly.appspot.com", // Ensure this is correct
  messagingSenderId: "803581911146",
  appId: "1:803581911146:web:90619eaffd400024ea2a13"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const firestore = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app);

/**
 * Adds or updates user data in Firestore.
 *
 * @param userId - Unique identifier for the user.
 * @param data - User data to be stored.
 * @returns Promise<void>
 */
export const addUserToFirestore = async (
  userId: string,
  data: { firstName: string; lastName: string; studentType: string; institution: string }
): Promise<void> => {
  try {
    const userRef = doc(firestore, 'users', userId);
    await setDoc(userRef, data, { merge: true }); // Merge to avoid overwriting existing data
    console.log('User data added to Firestore successfully.');
  } catch (error) {
    console.error('Error adding user to Firestore:', error);
    throw new Error('Failed to add user data.');
  }
};

/**
 * Uploads an image to Firebase Storage and returns its download URL.
 *
 * @param uri - Local URI of the image to be uploaded.
 * @param userId - Unique identifier for the user (used for storage path).
 * @param onProgress - Optional callback to track upload progress.
 * @returns Promise<string> - Download URL of the uploaded image.
 */
export const uploadImageAsync = async (
  uri: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    fetch(uri)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch image from URI: ${uri}`);
        }
        return response.blob();
      })
      .then((blob) => {
        const filename = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 15)}`; // Enhanced uniqueness
        const storageRef = ref(storage, `products/${filename}`);
        const uploadTask = uploadBytesResumable(storageRef, blob);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            if (onProgress) {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress(progress); // Invoke progress callback
            }
          },
          (error) => {
            console.error("Error uploading image:", error.code, error.message);
            reject(new Error(`Image upload failed: ${error.message}`));
          },
          () => {
            getDownloadURL(uploadTask.snapshot.ref)
              .then((downloadURL) => {
                console.log("Image uploaded successfully. Download URL:", downloadURL);
                resolve(downloadURL);
              })
              .catch((error) => {
                console.error("Error getting download URL:", error.code, error.message);
                reject(new Error("Failed to retrieve image URL."));
              });
          }
        );
      })
      .catch((error) => {
        console.error("Error processing image:", error);
        reject(new Error("Image processing failed."));
      });
  });
};

export { firestore, storage };
