// navigationTypes.ts
export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  AddProduct: undefined;
  Activity: undefined;
  Gigs: undefined;
  Messaging: undefined;
  AddGig: undefined; 
  Cart: undefined;
  Card: undefined;
  Account: undefined;
  EditProduct: { productId: string }; // Ensure this line exists
};
