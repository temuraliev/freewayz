import groq from "groq";

// Base product fields projection
const productFields = `
  _id,
  title,
  slug,
  description,
  price,
  originalPrice,
  "images": images[].asset->url,
  "videos": videos[].asset->url,
  "model3d": model3d.asset->url,
  "category": category->{ title, slug, subtypes },
  "style": style->{ title, slug },
  "brand": brand->{ title, slug },
  subtype,
  sizes,
  colors,
  isHotDrop,
  isOnSale,
  isNewArrival
`;

// Lighter projection for search (no 3d models, sizes, colors, description)
const searchProductFields = `
  _id,
  title,
  slug,
  price,
  originalPrice,
  "images": images[0...1].asset->url,
  "category": category->{ title, slug },
  "style": style->{ title, slug },
  "brand": brand->{ title, slug },
  isHotDrop,
  isOnSale,
  isNewArrival
`;

// All products query (all products are order-only / под заказ)
export const productsQuery = groq`
  *[_type == "product"] | order(_createdAt desc) {
    ${productFields}
  }
`;

// Single product by slug
export const productBySlugQuery = groq`
  *[_type == "product" && slug.current == $slug][0] {
    ${productFields}
  }
`;

// Products with filters — hot drops first, new arrivals second, then by date
export const productsByFilterQuery = groq`
  *[_type == "product"
    && ($saleOnly == false || isOnSale == true)
    && ($style == "" || style->slug.current == $style)
    && ($brand == "" || brand->slug.current == $brand)
    && ($category == "" || category->slug.current == $category)
    && ($subtype == "" || subtype == $subtype)
    && price >= $minPrice
    && price <= $maxPrice
  ] | order(isHotDrop desc, isNewArrival desc, _createdAt desc) {
    ${productFields}
  }
`;

// Hot Drops - first page
export const hotDropsQuery = groq`
  *[_type == "product" && isHotDrop == true && isOnSale != true] | order(_createdAt desc) [0...20] {
    ${productFields}
  }
`;

// Hot Drops paginated
export const hotDropsPaginatedQuery = groq`
  *[_type == "product" && isHotDrop == true && isOnSale != true] | order(_createdAt desc) [$offset...$limit] {
    ${productFields}
  }
`;

// Fresh Arrivals paginated
export const freshArrivalsPaginatedQuery = groq`
  *[_type == "product" && isNewArrival == true] | order(_createdAt desc) [$offset...$limit] {
    ${productFields}
  }
`;

// Sale products - first page
export const saleProductsQuery = groq`
  *[_type == "product" && isOnSale == true] | order(_createdAt desc) [0...20] {
    ${productFields}
  }
`;

// Sale products paginated
export const saleProductsPaginatedQuery = groq`
  *[_type == "product" && isOnSale == true] | order(_createdAt desc) [$offset...$limit] {
    ${productFields}
  }
`;

// Fresh Arrivals - products marked as new (first page)
export const freshArrivalsQuery = groq`
  *[_type == "product" && isNewArrival == true] | order(_createdAt desc) [0...20] {
    ${productFields}
  }
`;

export const searchProductsQuery = groq`
  *[_type == "product"] | order(_updatedAt desc) [0...50] {
    ${searchProductFields}
  }
`;

// Categories queries (with subtypes for filter drawer)
export const categoriesQuery = groq`
  *[_type == "category"] | order(title asc) {
    _id,
    title,
    slug,
    subtypes,
    "image": image.asset->url
  }
`;

// User queries
export const userByTelegramIdQuery = groq`
  *[_type == "user" && telegramId == $telegramId][0] {
    _id,
    telegramId,
    username,
    totalSpent,
    status,
    cashbackBalance
  }
`;

// Get all unique styles
export const stylesQuery = groq`
  *[_type == "style"] | order(isFeatured desc, title asc) {
    _id,
    title,
    slug
  }
`;

// Get all unique brands
export const brandsQuery = groq`
  *[_type == "brand"] | order(isFeatured desc, title asc) {
    _id,
    title,
    slug
  }
`;
