// Sanity Schema: User (for Loyalty Program)
// Copy this to your Sanity Studio schemas folder

import { Rule } from "sanity";

export const userSchema = {
  name: "user",
  title: "User",
  type: "document",
  fields: [
    {
      name: "telegramId",
      title: "Telegram ID",
      type: "string",
      validation: (Rule: Rule) => Rule.required(),
    },
    {
      name: "username",
      title: "Username",
      type: "string",
    },
    {
      name: "firstName",
      title: "First Name",
      type: "string",
    },
    {
      name: "lastName",
      title: "Last Name",
      type: "string",
    },
    {
      name: "photoUrl",
      title: "Photo URL",
      type: "url",
    },
    {
      name: "totalSpent",
      title: "Total Spent (USD)",
      type: "number",
      initialValue: 0,
      validation: (Rule: Rule) => Rule.min(0),
    },
    {
      name: "status",
      title: "Loyalty Status",
      type: "string",
      options: {
        list: [
          { title: "Rookie", value: "ROOKIE" },
          { title: "Pro", value: "PRO" },
          { title: "Legend", value: "LEGEND" },
        ],
      },
      initialValue: "ROOKIE",
    },
    {
      name: "cashbackBalance",
      title: "Cashback Balance (USD)",
      type: "number",
      initialValue: 0,
      validation: (Rule: Rule) => Rule.min(0),
    },
    {
      name: "orders",
      title: "Order History",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "orderId", type: "string", title: "Order ID" },
            { name: "date", type: "datetime", title: "Date" },
            { name: "total", type: "number", title: "Total" },
            {
              name: "items",
              type: "array",
              title: "Items",
              of: [
                {
                  type: "object",
                  fields: [
                    { name: "productId", type: "string", title: "Product ID" },
                    { name: "title", type: "string", title: "Title" },
                    { name: "brand", type: "string", title: "Brand" },
                    { name: "size", type: "string", title: "Size" },
                    { name: "color", type: "string", title: "Color" },
                    { name: "price", type: "number", title: "Price" },
                    { name: "quantity", type: "number", title: "Quantity" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "cartItems",
      title: "Saved Cart Items",
      description: "JSON string of currently saved cart items",
      type: "text",
    },
    {
      name: "cartUpdatedAt",
      title: "Cart Last Updated",
      type: "datetime",
    },
    {
      name: "abandonedCartNotified",
      title: "Abandoned Cart Notified",
      description: "Flag to track if the user has already received a notification for this cart",
      type: "boolean",
      initialValue: false,
    },
    {
      name: "referredBy",
      title: "Referred By (Telegram ID)",
      type: "string",
    },
  ],
  preview: {
    select: {
      title: "username",
      subtitle: "status",
      telegramId: "telegramId",
    },
    prepare(selection: Record<string, unknown>) {
      const { title, subtitle, telegramId } = selection;
      return {
        title: title || `User ${telegramId}`,
        subtitle: `Status: ${subtitle}`,
      };
    },
  },
};
