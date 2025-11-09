import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class ProductFilterInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => Int, { nullable: true })
  minPrice?: number;

  @Field(() => Int, { nullable: true })
  maxPrice?: number;

  @Field(() => String, { nullable: true })
  sku?: string;
}

@InputType()
export class ProductSortInput {
  @Field(() => String, { nullable: true })
  sortBy?: 'name' | 'price' | 'sku';

  @Field(() => String, { nullable: true })
  order?: 'ASC' | 'DESC';
}