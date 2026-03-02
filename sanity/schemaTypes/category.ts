import {defineField, defineType} from 'sanity'

export const categoryType = defineType({
  name: 'category',
  title: 'Category',
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
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'subtypes',
      title: 'Subtypes',
      type: 'array',
      of: [{type: 'string'}],
      description: 'e.g. for Обувь: Кроссовки, Лоферы, Ботинки. Shown in filters when this category is selected.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'image',
    },
  },
})

