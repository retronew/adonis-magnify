<div align="center">
<br/>

## @retronew/adonis-magnify

### Plug and play full-text search for your Adonis application

<br/>
</div>

<div align="center">

<!-- automd:badges color="brightgreen" license name="@retronew/adonis-magnify" bundlephobia packagephobia -->

[![npm version](https://img.shields.io/npm/v/@retronew/adonis-magnify?color=brightgreen)](https://npmjs.com/package/@retronew/adonis-magnify)
[![npm downloads](https://img.shields.io/npm/dm/@retronew/adonis-magnify?color=brightgreen)](https://npm.chart.dev/@retronew/adonis-magnify)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@retronew/adonis-magnify?color=brightgreen)](https://bundlephobia.com/package/@retronew/adonis-magnify)

<!-- /automd -->

<!-- automd:coverage -->

![Coverage](https://img.shields.io/badge/coverage-81%25-brightgreen)

<!-- /automd -->

</div>

## Description

Magnify provides a simple, driver based solution for adding full-text search to your Lucid models. Using Lucid hooks, Magnify automatically keep your search indexes in sync with your database.

Currently, Magnify ships with [Algolia](https://algolia.com), [Meilisearch](https://www.meilisearch.com/) and [Typesense](https://typesense.org/) engines. Furthermore, writing custom engines is simple and you are free to extend Magnify with your own search implementations.

```ts title="app/models/post.ts"
import { compose } from "@adonisjs/core/helpers";
import { BaseModel, column } from "@adonisjs/lucid/orm";
import { Searchable } from "@retronew/adonis-magnify";

export default class Post extends compose(BaseModel, Searchable) {
  @column({ isPrimary: true })
  declare id: string;

  @column()
  declare title: string;
}
```

```ts
import Post from "#models/post";

const posts = await Post.search("Adonis").take(10).get();
```

## Quickstart

[Installation & Getting Started](https://friendsofadonis.github.io/docs/magnify/getting-started)

## License

[MIT licensed](LICENSE.md).
