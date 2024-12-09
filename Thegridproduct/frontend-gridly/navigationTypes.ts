export type CartProduct = {
  id: string;
  title: string;
  price: number;
  images: string[];
  quantity: number;
  description?: string;
  category?: string;
  university?: string;
  userId: string; // Seller's ID
  postedDate?: string;
  rating?: number;
  quality?: string;
};


export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  AddProduct: undefined;
  Activity: undefined;
  Gigs: undefined;
  Messaging: { chatId: string; userId: string };
  AddGig: undefined;
  Cart: undefined;
  Payment: { product: CartProduct};
  Account: undefined;
  EditProduct: { productId: string };
};
