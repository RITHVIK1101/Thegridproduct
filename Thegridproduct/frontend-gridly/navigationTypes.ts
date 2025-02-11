// navigationTypes.ts
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
  Demo: undefined;
  Login: undefined;
  Verification: { email: string }; // <-- Added verification route with email param
  Dashboard: undefined;
  AddProduct: undefined;
  AllOrders: undefined;
  Activity: undefined;
  Jobs: undefined;
  JobDetail: { jobId: string };
  Messaging: { chatId?: string; userId?: string };
  AddGig: undefined;
  Cart: undefined;
  Payment: { product: CartProduct; buyerId: string; sellerId: string };
  Account: undefined;
  EditProduct: { productId: string };
  UserMenu: undefined;
  TermsOfService: undefined;
  LikedItems: undefined;
  ProductDetails: { productId: string };
  RequestProduct: undefined;
  RequestedProductsPage: undefined;
};
