// Sanity Schema Index
// Export all schemas for easy import into Sanity Studio

export { productSchema } from "./product";
export { categorySchema } from "./category";
export { userSchema } from "./user";

// Combined schemas array for Sanity Studio
// In your Sanity Studio's schema.ts, import like:
// import { schemas } from './schemas'
// export const schemaTypes = schemas;

export const schemas = [
  // Import the actual schema objects in your Sanity Studio
  // productSchema,
  // categorySchema,
  // userSchema,
];
