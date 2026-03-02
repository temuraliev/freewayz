import {defineField, defineType} from 'sanity'

export const styleType = defineType({
  name: 'style',
  title: 'Style',
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
      name: 'isFeatured',
      title: 'Featured',
      type: 'boolean',
      initialValue: true,
      description: 'Show this style near the top in filters',
    }),
  ],
  preview: {
    select: {title: 'title'},
  },
})

