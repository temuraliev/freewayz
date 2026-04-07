import { Product } from "@/lib/types";

// Mock products for development/demo (style/brand as refs)
const mockStyle = (title: string, slug: string) => ({ _id: slug, title, slug: { current: slug } });
const mockBrand = (title: string, slug: string) => ({ _id: slug, title, slug: { current: slug } });

export const MOCK_PRODUCTS: Product[] = [
    {
        _id: "1",
        title: "Washed Black Hoodie",
        slug: { current: "washed-black-hoodie" },
        price: 280,
        images: ["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80"],
        category: { _id: "hoodies", title: "Hoodies", slug: { current: "hoodies" } },
        style: mockStyle("Opium", "opium"),
        brand: mockBrand("Hellstar", "hellstar"),
        sizes: ["S", "M", "L", "XL"],
        colors: ["Black"],
        isHotDrop: true,
    },
    {
        _id: "2",
        title: "Distressed Cargo Pants",
        slug: { current: "distressed-cargo-pants" },
        price: 320,
        images: ["https://images.unsplash.com/photo-1509942774463-acf339cf87d5?w=800&q=80"],
        category: { _id: "pants", title: "Pants", slug: { current: "pants" } },
        style: mockStyle("Opium", "opium"),
        brand: mockBrand("Rick Owens", "rick-owens"),
        sizes: ["M", "L", "XL"],
        colors: ["Washed Black", "Olive"],
        isOnSale: true,
        originalPrice: 400,
    },
    {
        _id: "3",
        title: "Oversized Graphic Tee",
        slug: { current: "oversized-graphic-tee" },
        price: 150,
        images: ["https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=800&q=80"],
        category: { _id: "t-shirts", title: "T-Shirts", slug: { current: "t-shirts" } },
        style: mockStyle("Streetwear", "streetwear"),
        brand: mockBrand("Balenciaga", "balenciaga"),
        sizes: ["S", "M", "L"],
        colors: ["White", "Black"],
        isNewArrival: true,
    },
];

export const MOCK_PRODUCT: Product = {
    _id: "1",
    title: "Washed Black Hoodie",
    slug: { current: "washed-black-hoodie" },
    price: 280,
    images: [
        "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80",
        "https://images.unsplash.com/photo-1509942774463-acf339cf87d5?w=800&q=80",
        "https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=800&q=80",
    ],
    category: { _id: "hoodies", title: "Hoodies", slug: { current: "hoodies" } },
    style: mockStyle("Opium", "opium"),
    brand: mockBrand("Hellstar", "hellstar"),
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "Grey"],
};
