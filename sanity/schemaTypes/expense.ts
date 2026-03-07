import { defineField, defineType } from 'sanity'

export const expenseType = defineType({
  name: 'expense',
  title: 'Expense',
  type: 'document',
  fields: [
    defineField({
      name: 'date',
      title: 'Date',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'amount',
      title: 'Amount',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'currency',
      title: 'Currency',
      type: 'string',
      options: {
        list: [
          { title: 'UZS', value: 'UZS' },
          { title: 'CNY', value: 'CNY' },
          { title: 'USD', value: 'USD' },
        ],
        layout: 'dropdown',
      },
      initialValue: 'UZS',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Shipping', value: 'shipping' },
          { title: 'Purchase', value: 'purchase' },
          { title: 'Packaging', value: 'packaging' },
          { title: 'Other', value: 'other' },
        ],
        layout: 'dropdown',
      },
      initialValue: 'other',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'string',
    }),
    defineField({
      name: 'relatedOrder',
      title: 'Related Order',
      type: 'reference',
      to: [{ type: 'order' }],
      description: 'Optional link to an order',
    }),
  ],
  preview: {
    select: {
      amount: 'amount',
      currency: 'currency',
      category: 'category',
      date: 'date',
    },
    prepare(selection) {
      const { amount, currency, category, date } = selection
      const d = date ? new Date(date).toLocaleDateString() : ''
      return {
        title: `${amount} ${currency ?? 'UZS'} — ${category ?? 'other'}`,
        subtitle: d,
      }
    },
  },
})
