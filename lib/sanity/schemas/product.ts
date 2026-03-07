// Sanity Schema: Product
// Copy this to your Sanity Studio schemas folder

import { Rule } from "sanity";

export const productSchema = {
  name: "product",
  title: "Product",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule: Rule) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      validation: (Rule: Rule) => Rule.required(),
    },
    {
      name: "price",
      title: "Price (USD)",
      type: "number",
      validation: (Rule: Rule) => Rule.required().positive(),
    },
    {
      name: "originalPrice",
      title: "Original Price (for Sale items)",
      type: "number",
      description: "Set this higher than Price to show as strikethrough on sale items",
    },
    {
      name: "images",
      title: "Images",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
      validation: (Rule: Rule) => Rule.required().min(1),
    },
    {
      name: "category",
      title: "Category",
      type: "reference",
      to: [{ type: "category" }],
    },
    {
      name: "style",
      title: "Style",
      type: "string",
      options: {
        list: [
          { title: "Opium", value: "Opium" },
          { title: "Old Money", value: "Old Money" },
          { title: "UK Drill", value: "UK Drill" },
          { title: "Y2K", value: "Y2K" },
          { title: "Gorpcore", value: "Gorpcore" },
        ],
      },
      validation: (Rule: Rule) => Rule.required(),
    },
    {
      name: "brand",
      title: "Brand",
      type: "string",
      options: {
        list: [
          { title: "Mertra", value: "Mertra" },
          { title: "Hellstar", value: "Hellstar" },
          { title: "Corteiz", value: "Corteiz" },
          { title: "Rick Owens", value: "Rick Owens" },
          { title: "Balenciaga", value: "Balenciaga" },
          { title: "Chrome Hearts", value: "Chrome Hearts" },
          { title: "Gallery Dept", value: "Gallery Dept" },
          { title: "Represent", value: "Represent" },
          { title: "Amiri", value: "Amiri" },
          { title: "Off-White", value: "Off-White" },
        ],
      },
      validation: (Rule: Rule) => Rule.required(),
    },
    {
      name: "sizes",
      title: "Available Sizes",
      type: "array",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "XS", value: "XS" },
          { title: "S", value: "S" },
          { title: "M", value: "M" },
          { title: "L", value: "L" },
          { title: "XL", value: "XL" },
          { title: "XXL", value: "XXL" },
          { title: "One Size", value: "One Size" },
        ],
      },
      validation: (Rule: Rule) => Rule.required().min(1),
    },
    {
      name: "colors",
      title: "Available Colors",
      type: "array",
      of: [{ type: "string" }],
      description: "Add any color name (e.g. Black, Burgundy, Olive)",
    },
    {
      name: "isHotDrop",
      title: "Hot Drop / Trending",
      type: "boolean",
      description: "Feature this product in the Hot Drops section",
      initialValue: false,
    },
    {
      name: "description",
      title: "Description",
      type: "text",
      description: "Product description (auto-filled by AI import)",
      rows: 6,
    },
    {
      name: "subtype",
      title: "Subtype",
      type: "string",
      description: "Product subtype, e.g. Худи, Футболки, Джинсы",
    },
    {
      name: "sourceUrl",
      title: "Source URL",
      type: "url",
      description: "Original Yupoo album URL (used for deduplication)",
      hidden: true,
    },
    {
      name: "internalNotes",
      title: "Internal Notes (Manager Only)",
      type: "text",
      description: "Cost breakdown, profit margins — NOT visible to customers",
      rows: 8,
    },
    {
      name: "isOnSale",
      title: "On Sale",
      type: "boolean",
      description: "Show this product in the Sale section with discount pricing",
      initialValue: false,
    },
  ],
  preview: {
    select: {
      title: "title",
      brand: "brand",
      price: "price",
      media: "images.0",
      isHotDrop: "isHotDrop",
      isOnSale: "isOnSale",
    },
    prepare(selection: Record<string, unknown>) {
      const { title, brand, price, media, isHotDrop, isOnSale } = selection;
      const badges = [
        isHotDrop && "🔥",
        isOnSale && "💸",
      ].filter(Boolean).join(" ");
      return {
        title: `${badges} ${title}`.trim(),
        subtitle: `${brand} - $${price}`,
        media: media,
      };
    },
  },
};
