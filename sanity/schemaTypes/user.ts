import {defineArrayMember, defineField, defineType} from 'sanity'

export const userType = defineType({
  name: 'user',
  title: 'User',
  type: 'document',
  fields: [
    defineField({
      name: 'telegramId',
      title: 'Telegram ID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'username',
      title: 'Username',
      type: 'string',
    }),
    defineField({
      name: 'firstName',
      title: 'First Name',
      type: 'string',
    }),
    defineField({
      name: 'lastName',
      title: 'Last Name',
      type: 'string',
    }),
    defineField({
      name: 'photoUrl',
      title: 'Photo URL',
      type: 'url',
    }),
    defineField({
      name: 'totalSpent',
      title: 'Total Spent (UZS)',
      type: 'number',
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'status',
      title: 'Loyalty Status',
      type: 'string',
      options: {
        list: [
          {title: 'Rookie', value: 'ROOKIE'},
          {title: 'Pro', value: 'PRO'},
          {title: 'Legend', value: 'LEGEND'},
        ],
        layout: 'radio',
      },
      initialValue: 'ROOKIE',
    }),
    defineField({
      name: 'cashbackBalance',
      title: 'Cashback Balance (UZS)',
      type: 'number',
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'orders',
      title: 'Order History',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'order',
          fields: [
            defineField({name: 'orderId', type: 'string', title: 'Order ID'}),
            defineField({name: 'date', type: 'datetime', title: 'Date'}),
            defineField({name: 'total', type: 'number', title: 'Total'}),
            defineField({
              name: 'items',
              type: 'array',
              title: 'Items',
              of: [
                defineArrayMember({
                  type: 'object',
                  name: 'orderItem',
                  fields: [
                    defineField({name: 'productId', type: 'string', title: 'Product ID'}),
                    defineField({name: 'title', type: 'string', title: 'Title'}),
                    defineField({name: 'brand', type: 'string', title: 'Brand'}),
                    defineField({name: 'size', type: 'string', title: 'Size'}),
                    defineField({name: 'color', type: 'string', title: 'Color'}),
                    defineField({name: 'price', type: 'number', title: 'Price'}),
                    defineField({name: 'quantity', type: 'number', title: 'Quantity'}),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: {
      title: 'username',
      subtitle: 'status',
      telegramId: 'telegramId',
    },
    prepare(selection) {
      const {title, subtitle, telegramId} = selection as {
        title?: string
        subtitle?: string
        telegramId?: string
      }
      return {
        title: title || (telegramId ? `User ${telegramId}` : 'User'),
        subtitle: subtitle ? `Status: ${subtitle}` : 'Status: ROOKIE',
      }
    },
  },
})

