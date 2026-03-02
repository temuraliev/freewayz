import {type SchemaTypeDefinition} from 'sanity'

import {brandType} from './brand'
import {categoryType} from './category'
import {productType} from './product'
import {styleType} from './style'
import {userType} from './user'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [categoryType, brandType, styleType, productType, userType],
}
