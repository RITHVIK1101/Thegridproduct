export type CartProduct = {
  id: string;
  title: string;
  price: number;
  images: string[];
  quantity: number;
  description?: string; 
  category?: string; 
  university?: string; 
  sellerId: string;
  postedDate: string;
  rating?: number;
  quality?: string;
};

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  AddProduct: undefined;
  Activity: undefined;
  Jobs: undefined;
  Messaging: { chatId?: string; userId?: string }; // Updated: Expect chatId and userId for navigation
  AddGig: undefined;
  Cart: undefined;
  Payment: { product: CartProduct; buyerId: string; sellerId: string }; // Confirmed: Includes required parameters
  Account: undefined;
  EditProduct: { productId: string }; // Confirmed: Includes productId for editing
};