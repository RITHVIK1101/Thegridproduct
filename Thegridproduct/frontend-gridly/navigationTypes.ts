export type CartProduct = {
  id: string;
  title: string;
  price: number;
  images: string[];
  quantity: number;
  description?: string; 
  category?: string; 
  university?: string; 
  ownerId: string;
  postedDate: string;
  rating?: number;
  quality?: string;
};

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  AddProduct: undefined;
  Activity: undefined;
  Jobs: undefined; // Ensure Jobs is defined here
  Messaging: { chatId: string; userId: string };
  AddGig: undefined;
  Cart: undefined;
  Payment: { product: CartProduct; buyerId: string; sellerId: string };
  Account: undefined;
  EditProduct: { productId: string };
};
