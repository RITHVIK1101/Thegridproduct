// navigationTypes.ts

export type CartProduct = {
  id: string;
  title: string;
  price: number;
  images: string[];
  quantity: number;
  description?: string; // Made optional
  category?: string; // Made optional
  university?: string; // Made optional
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
  Gigs: undefined;
  Messaging: { chatId: string; userId: string };
  AddGig: undefined;
  Cart: undefined;
  Payment: { product: CartProduct; buyerId: string; sellerId: string };
  Account: undefined;
  EditProduct: { productId: string };
};
