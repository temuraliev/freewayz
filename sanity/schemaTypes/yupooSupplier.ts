import { defineField, defineType } from 'sanity'

export const yupooSupplierType = defineType({
  name: 'yupooSupplier',
  title: 'Yupoo Supplier',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Display name for the supplier',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      description: 'Base URL (e.g. https://pikachushop.x.yupoo.com/) or category URL',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'lastCheckedAt',
      title: 'Last Checked At',
      type: 'datetime',
      description: 'When the catalog was last checked for new albums',
    }),
    defineField({
      name: 'lastAlbumCount',
      title: 'Last Album Count',
      type: 'number',
      description: 'Number of albums at last check (used to detect new items)',
    }),
    defineField({
      name: 'knownAlbumIds',
      title: 'Known Album IDs',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Album IDs already seen — only new ones trigger notifications',
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      description: 'Whether to include this supplier in periodic monitoring',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      name: 'name',
      lastAlbumCount: 'lastAlbumCount',
      isActive: 'isActive',
    },
    prepare(selection) {
      const { name, lastAlbumCount, isActive } = selection
      return {
        title: name ?? 'Unnamed supplier',
        subtitle: isActive
          ? `Albums: ${lastAlbumCount ?? '—'}`
          : 'Inactive',
      }
    },
  },
})
