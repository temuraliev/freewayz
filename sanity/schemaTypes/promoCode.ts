import { defineArrayMember, defineField, defineType } from 'sanity'

export const promoCodeType = defineType({
  name: 'promoCode',
  title: 'Promo Code',
  type: 'document',
  fields: [
    defineField({
      name: 'code',
      title: 'Code',
      type: 'string',
      validation: (rule) => rule.required(),
      description: 'Unique promo code, e.g. SUMMER10',
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { title: 'Discount %', value: 'discount_percent' },
          { title: 'Discount Fixed (UZS)', value: 'discount_fixed' },
          { title: 'Balance Top-up (UZS)', value: 'balance_topup' },
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'value',
      title: 'Value',
      type: 'number',
      validation: (rule) => rule.required().min(0),
      description: 'Percent (e.g. 10 for 10%) or amount in UZS',
    }),
    defineField({
      name: 'minOrderTotal',
      title: 'Minimum Order Total (UZS)',
      type: 'number',
      description: 'Minimum cart total for discount codes (optional)',
    }),
    defineField({
      name: 'maxUses',
      title: 'Max Total Uses',
      type: 'number',
      description: 'Total usage limit. Leave empty for unlimited.',
    }),
    defineField({
      name: 'usedCount',
      title: 'Used Count',
      type: 'number',
      initialValue: 0,
      readOnly: true,
    }),
    defineField({
      name: 'maxUsesPerUser',
      title: 'Max Uses Per User',
      type: 'number',
      initialValue: 1,
    }),
    defineField({
      name: 'usedBy',
      title: 'Used By',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'promoUsage',
          fields: [
            defineField({ name: 'telegramId', type: 'string', title: 'Telegram ID' }),
            defineField({ name: 'usedAt', type: 'datetime', title: 'Used At' }),
          ],
        }),
      ],
      readOnly: true,
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'expiresAt',
      title: 'Expires At',
      type: 'datetime',
      description: 'Optional expiration date',
    }),
  ],
  preview: {
    select: {
      code: 'code',
      type: 'type',
      value: 'value',
      isActive: 'isActive',
    },
    prepare(selection) {
      const { code, type, value, isActive } = selection
      const label =
        type === 'discount_percent'
          ? `${value}%`
          : type === 'discount_fixed'
            ? `${(value ?? 0).toLocaleString()} UZS`
            : `+${(value ?? 0).toLocaleString()} UZS (balance)`
      return {
        title: `${code} — ${label}`,
        subtitle: isActive ? 'Active' : 'Inactive',
      }
    },
  },
})
