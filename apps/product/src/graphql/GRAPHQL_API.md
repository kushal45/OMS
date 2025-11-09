# Product Service GraphQL API Documentation

## Queries

### Get All Products
Fetch products with optional filtering and sorting.

```graphql
query GetProducts($filter: ProductFilterInput, $sort: ProductSortInput) {
  products(filter: $filter, sort: $sort) {
    id
    name
    description
    price
    sku
  }
}
```

Variables example:
```json
{
  "filter": {
    "minPrice": 100,
    "maxPrice": 500,
    "name": "laptop"
  },
  "sort": {
    "sortBy": "price",
    "order": "DESC"
  }
}
```

### Get Product by ID
Fetch a single product by its ID.

```graphql
query GetProduct($id: Int!) {
  product(id: $id) {
    id
    name
    description
    price
    sku
  }
}
```

Variables example:
```json
{
  "id": 1
}
```

### Get Product by SKU
Fetch a single product by its SKU.

```graphql
query GetProductBySku($sku: String!) {
  productBySku(sku: $sku) {
    id
    name
    description
    price
    sku
  }
}
```

Variables example:
```json
{
  "sku": "LAPTOP-001"
}
```

## Input Types

### ProductFilterInput
Filter criteria for products query:
- `name`: String (partial match)
- `minPrice`: Int
- `maxPrice`: Int
- `sku`: String (exact match)

### ProductSortInput
Sort criteria for products query:
- `sortBy`: String ("name" | "price" | "sku")
- `order`: String ("ASC" | "DESC")

## Migration from REST

### Previous REST endpoints and their GraphQL equivalents:

1. `GET /products`:
```graphql
query {
  products {
    id
    name
    description
    price
    sku
  }
}
```

2. `GET /products/:id`:
```graphql
query {
  product(id: 123) {
    id
    name
    description
    price
    sku
  }
}
```

3. New functionality (not in REST):
- Filter by price range
- Sort by multiple fields
- Search by SKU
- Partial name matches