import groq from "groq";

// Base product fields projection
const productFields = `
  _id,
  tier,
  title,
  slug,
  description,
  price,
  originalPrice,
  "images": images[].asset->url,
  "videos": videos[].asset->url,
  "model3d": model3d.asset->url,
  "category": category->{ _id, title, slug, subtypes },
  "style": style->{ _id, title, slug },
  "brand": brand->{ _id, title, slug },
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
  tier,
  title,
  slug,
  price,
  originalPrice,
  "images": images[0...1].asset->url,
  "category": category->{ _id, title, slug },
  "style": style->{ _id, title, slug },
  "brand": brand->{ _id, title, slug },
  subtype,
  isHotDrop,
  isOnSale,
  isNewArrival
`;

// All products query (all products are order-only / под заказ)
export const productsQuery = groq`
  *[_type == "product" && tier == $tier] | order(_createdAt desc) {
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
    && tier == $tier
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
  *[_type == "product" && tier == $tier && isHotDrop == true && isOnSale != true] | order(_createdAt desc) [0...20] {
    ${productFields}
  }
`;

// Hot Drops paginated
export const hotDropsPaginatedQuery = groq`
  *[_type == "product" && tier == $tier && isHotDrop == true && isOnSale != true] | order(_createdAt desc) [$offset...$limit] {
    ${productFields}
  }
`;

// Fresh Arrivals paginated
export const freshArrivalsPaginatedQuery = groq`
  *[_type == "product" && tier == $tier && isNewArrival == true] | order(_createdAt desc) [$offset...$limit] {
    ${productFields}
  }
`;

// Sale products - first page
export const saleProductsQuery = groq`
  *[_type == "product" && tier == $tier && isOnSale == true] | order(_createdAt desc) [0...20] {
    ${productFields}
  }
`;

// Sale products paginated
export const saleProductsPaginatedQuery = groq`
  *[_type == "product" && tier == $tier && isOnSale == true] | order(_createdAt desc) [$offset...$limit] {
    ${productFields}
  }
`;

// Fresh Arrivals - products marked as new (first page)
export const freshArrivalsQuery = groq`
  *[_type == "product" && tier == $tier && isNewArrival == true] | order(_createdAt desc) [0...20] {
    ${productFields}
  }
`;

export const searchProductsQuery = groq`
  *[_type == "product" && tier == $tier && (
    title match $searchTerms || 
    brand->title match $searchTerms || 
    category->title match $searchTerms || 
    style->title match $searchTerms ||
    subtype match $searchTerms ||
    pt::text(description) match $searchTerms
  )] | order(_updatedAt desc) [0...80] {
    ${searchProductFields}
  }
`;

// Distinct subtypes for current filters (brand, style, category, saleOnly) — for dynamic subtype chips
export const distinctSubtypesQuery = groq`
  *[_type == "product"
    && tier == $tier
    && ($saleOnly == false || isOnSale == true)
    && ($style == "" || style->slug.current == $style)
    && ($brand == "" || brand->slug.current == $brand)
    && ($category == "" || category->slug.current == $category)
    && price >= $minPrice
    && price <= $maxPrice
  ] { subtype }
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
    firstName,
    totalSpent,
    status,
    cashbackBalance,
    onboardingDone,
    "preferredBrands": preferredBrands[]->{ _id, title, slug },
    "preferredStyles": preferredStyles[]->{ _id, title, slug }
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
