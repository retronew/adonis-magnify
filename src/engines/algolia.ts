import { ModelPaginator } from '@adonisjs/lucid/orm'
import { Builder } from '../builder.js'
import { AlgoliaConfig, SearchableModel, SearchableRow } from '../types.js'
import { MagnifyEngine } from './main.js'
import {
  algoliasearch,
  Algoliasearch,
  NumericFilters,
  SearchParams,
  SearchResponse,
} from 'algoliasearch'
import is from '@adonisjs/core/helpers/is'

export class AlgoliaEngine implements MagnifyEngine {
  readonly #client: Algoliasearch

  constructor(config: AlgoliaConfig) {
    this.#client = algoliasearch(config.appId, config.apiKey, config.options)
  }

  get client(): Algoliasearch {
    return this.#client
  }

  async update(...models: SearchableRow[]): Promise<void> {
    if (models.length <= 0) {
      return
    }

    const Static = models[0].constructor as SearchableModel

    const objects = models.map((model) => {
      const searchableData = model.toSearchableObject()

      return {
        ...searchableData,
        objectID: model.$searchKeyValue,
      }
    })

    await this.#client.saveObjects({
      indexName: Static.$searchIndex,
      objects: objects,
    })
  }

  async delete(...models: SearchableRow[]): Promise<void> {
    if (models.length <= 0) {
      return
    }

    const Static = models[0].constructor as SearchableModel
    const keys = models.map((model) => model.$searchKeyValue.toString())

    await this.#client.deleteObjects({ indexName: Static.$searchIndex, objectIDs: keys })
  }

  async search(builder: Builder): Promise<SearchResponse> {
    return this.#performSearch(builder, {
      numericFilters: this.#filters(builder),
      hitsPerPage: builder.$limit,
    })
  }

  map(builder: Builder, results: SearchResponse): Promise<any[]> {
    const ids = results.hits.map((hit) => hit.objectID)
    return builder.$model.$queryMagnifyModelsByIds(builder, ...ids)
  }

  async paginate(builder: Builder, page: number, perPage: number): Promise<ModelPaginator> {
    const results = await this.#performSearch(builder, {
      page: page - 1,
      hitsPerPage: perPage,
      numericFilters: this.#filters(builder),
    })

    return new ModelPaginator(
      results.nbHits ?? results.hits.length,
      page,
      perPage,
      ...(await this.map(builder, results))
    )
  }

  async flush(model: SearchableModel): Promise<void> {
    await this.#client.clearObjects({ indexName: model.$searchIndex })
  }

  async get(builder: Builder): Promise<any[]> {
    return this.map(builder, await this.search(builder))
  }

  #formatFilterValue(value: any): string | number {
    if (is.boolean(value)) {
      return value ? 1 : 0
    }
    if (is.number(value)) {
      return value
    }
    return value.toString()
  }

  #filters(builder: Builder): NumericFilters | undefined {
    const filters: string[] = []

    // Handle wheres
    Object.entries(builder.$wheres).forEach(([key, value]) => {
      filters.push(`${key} = ${this.#formatFilterValue(value)}`)
    })

    // Handle whereNots
    Object.entries(builder.$whereNots).forEach(([key, value]) => {
      filters.push(`NOT ${key} = ${this.#formatFilterValue(value)}`)
    })

    // Handle whereIns
    Object.entries(builder.$whereIns).forEach(([key, values]) => {
      if (values.length) {
        filters.push('0 = 1')
      } else {
        values.forEach(value => {
          filters.push(`${key} = ${this.#formatFilterValue(value)}`)
        })
      }
    })

    return filters.length <= 0 ? undefined : filters
  }

  #performSearch(builder: Builder, params: SearchParams = {}) {
    return this.#client.searchSingleIndex({
      indexName: builder.$model.$searchIndex,
      searchParams: {
        query: builder.$query,
        ...params,
      },
    })
  }
}
