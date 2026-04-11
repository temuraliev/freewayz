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

// All products query
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

// Products with filters — first page (limited to 20)
export const productsByFilterQuery = groq`
  *[_type == "product"
    && ($saleOnly == false || isOnSale == true)
    && ($style == "" || style->slug.current == $style)
    && ($brand == "" || brand->slug.current == $brand)
    && ($category == "" || category->slug.current == $category)
    && ($subtype == "" || subtype == $subtype)
    && price >= $minPrice
    && price <= $maxPrice
  ] | order(isHotDrop desc, isNewArrival desc, _createdAt desc) [0...20] {
    ${productFields}
  }
`;

// Products with filters — paginated (infinite scroll)
export const productsByFilterPaginatedQuery = groq`
  *[_type == "product"
    && ($saleOnly == false || isOnSale == true)
    && ($style == "" || style->slug.current == $style)
    && ($brand == "" || brand->slug.current == $brand)
    && ($category == "" || category->slug.current == $category)
    && ($subtype == "" || subtype == $subtype)
    && price >= $minPrice
    && price <= $maxPrice
  ] | order(isHotDrop desc, isNewArrival desc, _createdAt desc) [$offset...$limit] {
    ${productFields}
  }
`;

// Count of filtered products
export const productsByFilterCountQuery = groq`
  count(*[_type == "product"
    && ($saleOnly == false || isOnSale == true)
    && ($style == "" || style->slug.current == $style)
    && ($brand == "" || brand->slug.current == $brand)
    && ($category == "" || category->slug.current == $category)
    && ($subtype == "" || subtype == $subtype)
    && price >= $minPrice
    && price <= $maxPrice
  ])
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

// Fresh Arrivals - first page
export const freshArrivalsQuery = groq`
  *[_type == "product" && isNewArrival == true] | order(_createdAt desc) [0...20] {
    ${productFields}
  }
`;

export const searchProductsQuery = groq`
  *[_type == "product" && (
    title match $searchTerms ||
    brand->title match $searchTerms ||
    category->title match $searchTerms ||
    style->title match $searchTerms ||
    subtype match $searchTerms ||
    pt::text(description) match $searchTerms ||
    internalNotes match $searchTerms
  )] | order(_updatedAt desc) [0...80] {
    ${searchProductFields}
  }
`;

// Distinct subtypes for current filters
export const distinctSubtypesQuery = groq`
  *[_type == "product"
    && ($saleOnly == false || isOnSale == true)
    && ($style == "" || style->slug.current == $style)
    && ($brand == "" || brand->slug.current == $brand)
    && ($category == "" || category->slug.current == $category)
    && price >= $minPrice
    && price <= $maxPrice
  ] { subtype }
`;

export const relatedProductsQuery = groq`
  *[_type == "product" && _id != $currentProductId && (
    brand._ref == $brandId || style._ref == $styleId || category._ref == $categoryId
  )] | order(isHotDrop desc, _createdAt desc) [0...6] {
    ${productFields}
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

// Essentials — accessories shown at checkout (hangers, shoe boxes, rollers, etc.)
export const essentialsQuery = groq`
  *[_type == "product" && isEssential == true] | order(_createdAt desc) [0...10] {
    _id,
    title,
    slug,
    price,
    "images": images[0...1].asset->url,
    "brand": brand->{ _id, title, slug },
    subtype
  }
`;
