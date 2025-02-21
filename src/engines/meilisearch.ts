import { MeilisearchConfig, SearchableModel, SearchableRow } from '../types.js'
import { MeiliSearch, SearchParams, SearchResponse } from 'meilisearch'
import { Builder } from '../builder.js'
import { ModelPaginator } from '@adonisjs/lucid/orm'
import { MagnifyEngine } from './main.js'
import is from '@adonisjs/core/helpers/is'

export class MeilisearchEngine implements MagnifyEngine {
  #config: MeilisearchConfig

  readonly #client: MeiliSearch

  constructor(config: MeilisearchConfig) {
    this.#config = config
    this.#client = new MeiliSearch(config)
  }

  get client(): MeiliSearch {
    return this.#client
  }

  async update(...models: SearchableRow[]): Promise<void> {
    if (models.length <= 0) {
      return
    }

    const Static = models[0].constructor as SearchableModel

    const index = this.#client.index(Static.$searchIndex)

    const objects = models.map((model) => {
      const searchableData = model.toSearchableObject()

      return {
        ...searchableData,
        [Static.$searchKey]: model.$searchKeyValue,
      }
    })

    await index.addDocuments(objects, { primaryKey: Static.$searchKey })
  }

  async delete(...models: SearchableRow[]): Promise<void> {
    if (models.length <= 0) {
      return
    }

    const Static = models[0].constructor as SearchableModel

    const index = this.#client.index(Static.$searchIndex)

    const keys = models.map((model) => model.$searchKeyValue)

    await index.deleteDocuments(keys as string[] | number[])
  }

  async search<T extends Record<string, any> = Record<string, any>>(builder: Builder) {
    return this.#performSearch<T>(builder, {
      filter: this.#filters(builder),
      hitsPerPage: builder.$limit,
      sort: this.#buildSortFromOrderByClauses(builder),
    })
  }

  async paginate(builder: Builder, page: number, perPage: number): Promise<ModelPaginator> {
    const results = await this.#performSearch(builder, {
      page,
      hitsPerPage: perPage,
      sort: this.#buildSortFromOrderByClauses(builder),
    })

    return new ModelPaginator(
      results.hitsPerPage,
      perPage,
      page,
      ...(await this.map(builder, results))
    )
  }

  async flush(model: SearchableModel): Promise<void> {
    const index = this.#client.index(model.$searchIndex)
    await index.deleteAllDocuments()
  }

  async map<
    T extends Record<string, any> = Record<string, any>,
    S extends SearchParams = SearchParams,
  >(builder: Builder, results: SearchResponse<T, S>): Promise<any[]> {
    const ids = results.hits.map((hit) => hit[builder.$model.$searchKey])
    return builder.$model.$queryMagnifyModelsByIds(builder, ...ids)
  }

  async get(builder: Builder): Promise<any[]> {
    return this.map(builder, await this.search(builder))
  }

  async syncIndexSettings() {
    if (!this.#config.indexSettings) return
    for (const [name, settings] of Object.entries(this.#config.indexSettings)) {
      await this.#client.createIndex(name)
      await this.#client.index(name).updateSettings(settings)
    }
  }

  #formatFilterValue(value: any): string {
    if (is.boolean(value)) {
      return value ? 'true' : 'false'
    }
    if (is.number(value)) {
      return value.toString()
    }
    return `"${value}"`
  }

  #filters(builder: Builder) {
    const filters: string[] = []

    // Handle normal wheres
    Object.entries(builder.$wheres).map(([key, value]) => {
      filters.push(`${key}=${this.#formatFilterValue(value)}`)
    })

    // Handle whereNots
    Object.entries(builder.$whereNots).map(([key, value]) => {
      filters.push(`NOT ${key}=${this.#formatFilterValue(value)}`)
    })

    // Handle whereIns and whereNotIns
    for (const [operator, property] of [
      ['IN', builder.$whereIns],
      ['NOT IN', builder.$whereNotIns],
    ] as const) {
      for (const [key, values] of Object.entries(property)) {
        const filterValue = values
          .map((value) => this.#formatFilterValue(value))
          .join(', ')

        filters.push(`${key} ${operator} [${filterValue}]`)
      }
    }

    return filters.join(' AND ')
  }

  #buildSortFromOrderByClauses(builder: Builder): string[] {
    return builder.$orders.map((order) => `${order.column}:${order.direction}`)
  }

  #performSearch<
    T extends Record<string, any> = Record<string, any>,
    S extends SearchParams = SearchParams,
  >(builder: Builder, searchParams: S) {
    const index = this.#client.index<T>(builder.$index ?? builder.$model.$searchIndex)

    const baseParameters = this.#buildSearchParameters(builder)

    const finalParameters = {
      ...baseParameters,
      ...searchParams,
    }

    if (finalParameters.attributesToRetrieve) {
      finalParameters.attributesToRetrieve.unshift(builder.$model.$searchKey)
    }

    return index.search(builder.$query, finalParameters)
  }

  #buildSearchParameters(builder: Builder, page = 1, perPage = 250) {
    const parameters: SearchParams = {
      q: builder.$query,
      page,
      hitsPerPage: perPage,
      attributesToHighlight: builder.$highlightFields,
    }

    return parameters
  }
}
