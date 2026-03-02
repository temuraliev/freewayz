import {defineField, defineType} from 'sanity'

export const brandType = defineType({
  name: 'brand',
  title: 'Brand',
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
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'logo',
      title: 'Logo',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'isFeatured',
      title: 'Featured',
      type: 'boolean',
      initialValue: false,
      description: 'Show this brand near the top in filters',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'logo',
    },
  },
})

