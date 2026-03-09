import { defineArrayMember, defineField, defineType } from 'sanity'

export const orderType = defineType({
  name: 'order',
  title: 'Order',
  type: 'document',
  fields: [
    defineField({
      name: 'orderId',
      title: 'Order ID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'user',
      title: 'Customer',
      type: 'reference',
      to: [{ type: 'user' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'orderItem',
          fields: [
            defineField({ name: 'productId', type: 'string', title: 'Product ID' }),
            defineField({ name: 'title', type: 'string', title: 'Title' }),
            defineField({ name: 'brand', type: 'string', title: 'Brand' }),
            defineField({ name: 'size', type: 'string', title: 'Size' }),
            defineField({ name: 'color', type: 'string', title: 'Color' }),
            defineField({ name: 'price', type: 'number', title: 'Price' }),
            defineField({ name: 'quantity', type: 'number', title: 'Quantity' }),
          ],
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'total',
      title: 'Total (UZS)',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'New', value: 'new' },
          { title: 'Paid', value: 'paid' },
          { title: 'Ordered', value: 'ordered' },
          { title: 'Shipped', value: 'shipped' },
          { title: 'Delivered', value: 'delivered' },
          { title: 'Cancelled', value: 'cancelled' },
        ],
        layout: 'dropdown',
      },
      initialValue: 'new',
    }),
    defineField({
      name: 'trackNumber',
      title: 'Tracking Number',
      type: 'string',
    }),
    defineField({
      name: 'trackUrl',
      title: 'Tracking URL',
      type: 'url',
      description: 'e.g. 17track.net or Cainiao link',
    }),
    defineField({
      name: 'carrier',
      title: 'Carrier',
      type: 'string',
      description: 'Carrier code for 17track',
    }),
    defineField({
      name: 'track17Registered',
      title: '17track Registered',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'trackingStatus',
      title: 'Tracking Status',
      type: 'string',
      description: 'Latest status from 17track',
    }),
    defineField({
      name: 'trackingEvents',
      title: 'Tracking Events',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'trackingEvent',
          fields: [
            defineField({ name: 'date', type: 'datetime', title: 'Date' }),
            defineField({ name: 'status', type: 'string', title: 'Status' }),
            defineField({ name: 'description', type: 'string', title: 'Description' }),
            defineField({ name: 'location', type: 'string', title: 'Location' }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'shippingMethod',
      title: 'Shipping Method',
      type: 'string',
      description: 'e.g. Air, Sea, Express',
    }),
    defineField({
      name: 'promoCode',
      title: 'Promo Code',
      type: 'string',
      description: 'Promo code applied at checkout',
    }),
    defineField({
      name: 'discount',
      title: 'Discount (UZS)',
      type: 'number',
      description: 'Discount amount applied',
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated At',
      type: 'datetime',
    }),
  ],
  preview: {
    select: {
      orderId: 'orderId',
      status: 'status',
      total: 'total',
    },
    prepare(selection) {
      const { orderId, status, total } = selection
      return {
        title: `#${orderId}`,
        subtitle: `${status ?? 'new'} — ${total != null ? `${total.toLocaleString()} UZS` : ''}`,
      }
    },
  },
})
