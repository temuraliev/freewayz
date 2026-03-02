import {defineArrayMember, defineField, defineType} from 'sanity'

export const productType = defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description (Russian)',
      type: 'text',
      description: 'Product description for the product page',
    }),
    defineField({
      name: 'price',
      title: 'Price (UZS)',
      type: 'number',
      validation: (rule) => rule.required().positive(),
    }),
    defineField({
      name: 'originalPrice',
      title: 'Original Price (for Sale items)',
      type: 'number',
      description: 'Set this higher than Price to show as strikethrough on sale items',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [defineArrayMember({type: 'image', options: {hotspot: true}})],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'videos',
      title: 'Videos (shown first in carousel)',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'file',
          options: { accept: 'video/*', storeOriginalFilename: true },
        }),
      ],
      description: 'Optional. Add manually; always shown before images in the product carousel.',
    }),
    defineField({
      name: 'model3d',
      title: '3D Model (.glb)',
      type: 'file',
      options: {
        accept: '.glb',
        storeOriginalFilename: true,
      },
      description: 'Optional GLB model for 3D viewer on product page',
    }),
    defineField({
      name: 'subtype',
      title: 'Subtype',
      type: 'string',
      description: 'e.g. Кроссовки, Лоферы when category is Обувь',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{type: 'category'}],
    }),
    defineField({
      name: 'style',
      title: 'Style',
      type: 'reference',
      to: [{type: 'style'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'brand',
      title: 'Brand',
      type: 'reference',
      to: [{type: 'brand'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sizes',
      title: 'Available Sizes',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {
        list: [
          {title: 'XS', value: 'XS'},
          {title: 'S', value: 'S'},
          {title: 'M', value: 'M'},
          {title: 'L', value: 'L'},
          {title: 'XL', value: 'XL'},
          {title: 'XXL', value: 'XXL'},
          {title: 'One Size', value: 'One Size'},
        ],
      },
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'colors',
      title: 'Available Colors',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      description: 'Add any color name (e.g. Black, Burgundy, Olive)',
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'isHotDrop',
      title: 'Hot Drop / Trending',
      type: 'boolean',
      description: 'Feature this product in the Hot Drops section',
      initialValue: false,
    }),
    defineField({
      name: 'isOnSale',
      title: 'On Sale',
      type: 'boolean',
      description: 'Show this product in the Sale section with discount pricing',
      initialValue: false,
    }),
    defineField({
      name: 'isNewArrival',
      title: 'Fresh Arrival',
      type: 'boolean',
      description: 'Show in Fresh Arrivals section',
      initialValue: false,
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Source URL (Yupoo)',
      type: 'string',
      description: 'Link to the original product page (e.g. Yupoo). For internal use only — not shown on the site.',
      hidden: ({document}) => !document?.sourceUrl,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      brand: 'brand.title',
      price: 'price',
      media: 'images.0',
      isHotDrop: 'isHotDrop',
      isOnSale: 'isOnSale',
      isNewArrival: 'isNewArrival',
    },
    prepare(selection) {
      const {title, brand, price, media, isHotDrop, isOnSale, isNewArrival} = selection as {
        title?: string
        brand?: string
        price?: number
        media?: unknown
        isHotDrop?: boolean
        isOnSale?: boolean
        isNewArrival?: boolean
      }

      const badges = [isHotDrop && '🔥', isOnSale && '💸', isNewArrival && '🆕'].filter(Boolean).join(' ')

      return {
        title: `${badges} ${title ?? ''}`.trim(),
        subtitle: `${brand ?? ''}${typeof price === 'number' ? ` — ${price} UZS` : ''}`.trim(),
        media: media as string | undefined,
      }
    },
  },
})

