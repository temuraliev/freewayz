// TypeScript types for the FreeWayz store

export interface Product {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
  description?: string | null;
  price: number;
  originalPrice?: number;
  images: string[];
  videos?: string[];
  model3d?: string | null;
  category: {
    _id: string;
    title: string;
    slug: { current: string };
    subtypes?: string[];
  } | null;
  subtype?: string | null;
  style: Style | null;
  brand: Brand | null;
  sizes: Size[];
  colors: Color[];
  isHotDrop?: boolean;
  isOnSale?: boolean;
  isNewArrival?: boolean;
}

export interface Brand {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
  logo?: string | null;
}

export interface Style {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
}

export interface Category {
  _id: string;
  title: string;
  slug: { current: string };
  subtypes?: string[];
  image: string | null;
}

export interface User {
  _id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  totalSpent: number;
  status: UserStatus;
  cashbackBalance: number;
  onboardingDone?: boolean;
  preferredBrands?: { _id: string; title: string; slug: { current: string } }[];
  preferredStyles?: { _id: string; title: string; slug: { current: string } }[];
}

// Note: Styles/Brands are now controlled in Sanity as documents.

export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "One Size";

export type Color = string;

export type UserStatus = "ROOKIE" | "PRO" | "LEGEND";

export interface CartItem {
  product: Product;
  size: Size;
  color: Color | null;
  quantity: number;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface FilterState {
  style: string | null;
  brand: string | null;
  category: string | null;
  subtype: string | null;
  saleOnly: boolean;
}

// ── Order types (shared between admin pages, API, bot) ────

export interface OrderItem {
  productId: string;
  title: string;
  brand?: string;
  size: string;
  color?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface TrackingEvent {
  time: string;
  location?: string;
  stage?: string;
  text: string;
}

export type OrderStatus =
  | "new"
  | "paid"
  | "ordered"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Order {
  id: number;
  orderId: string;
  userId: number;
  items: OrderItem[];
  total: number;
  cost?: number | null;
  status: OrderStatus;
  trackNumber?: string | null;
  trackUrl?: string | null;
  carrier?: string | null;
  trackingStatus?: string | null;
  trackingEvents?: TrackingEvent[] | null;
  shippingMethod?: string | null;
  promoCode?: string | null;
  discount?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    telegramId: string;
    username: string | null;
    firstName: string | null;
  } | null;
}

// ── API response types ────────────────────────────────────

export interface ApiErrorResponse {
  error: string;
  code: string;
}

export interface RecommendationsResponse {
  products: Product[];
  tier: 1 | 2 | 3;
}
