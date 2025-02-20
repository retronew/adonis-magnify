import { SearchableModel, SearchableRow, TypesenseConfig } from '../types.js'
import { Client } from 'typesense'
import { MagnifyEngine } from './main.js'
import { Builder } from '../builder.js'
import Collection from 'typesense/lib/Typesense/Collection.js'
import { SearchParams, SearchResponse } from 'typesense/lib/Typesense/Documents.js'
import is from '@adonisjs/core/helpers/is'
import { ModelPaginator } from '@adonisjs/lucid/orm'

export class TypesenseEngine implements MagnifyEngine {
  #config: TypesenseConfig

  readonly #client: Client

  constructor(config: TypesenseConfig) {
    this.#config = config
    this.#client = new Client(config)
  }

  get client(): Client {
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
        [Static.$searchKey]: model.$searchKeyValue.toString(),
      }
    })

    const collection = await this.#getOrCreateCollectionFromModel(Static)

    try {
      await collection.documents().import(objects, { action: 'upsert' })
    } catch (e) {
      if ('importResults' in e) {
        console.error(e.importResults)
      }

      throw e
    }
  }

  async delete(...models: SearchableRow[]): Promise<void> {
    const Static = models[0].constructor as SearchableModel
    const collection = await this.#getOrCreateCollectionFromModel(Static)

    await Promise.all(
      models.map((model) => collection.documents(model.$searchKeyValue.toString()).delete())
    )
  }

  search(builder: Builder): Promise<any> {
    return this.#performSearch(builder, this.#buildSearchParameters(builder, 1))
  }

  async flush(model: SearchableModel): Promise<void> {
    const collection = this.#client.collections(model.$searchIndex)
    await collection.delete()
  }

  async map(builder: Builder, results: SearchResponse<any>): Promise<any[]> {
    if (results.found <= 0) {
      return []
    }

    const hits = results.grouped_hits
      ? results.grouped_hits.flatMap((g) => g.hits)
      : (results.hits ?? [])

    const ids = hits.map((hit) => hit.document[builder.$model.$searchKey])
    return builder.$model.$queryMagnifyModelsByIds(builder, ...ids)
  }

  async paginate(builder: Builder, page: number, perPage: number): Promise<ModelPaginator> {
    const results = await this.#performSearch(
      builder,
      this.#buildSearchParameters(builder, page, perPage)
    )

    return new ModelPaginator(
      results.found,
      perPage,
      page,
      ...(await this.map(builder, results))
    )
  }

  async get(builder: Builder): Promise<any[]> {
    return this.map(builder, await this.search(builder))
  }

  async #performSearch(builder: Builder, params: SearchParams) {
    const collection = await this.#getOrCreateCollectionFromModel(builder.$model)
    return collection.documents().search(params)
  }

  #buildSearchParameters(builder: Builder, page = 1, perPage = 250) {
    const parameters: SearchParams = {
      q: builder.$query,
      query_by: this.#config.collectionSettings[builder.$model.$searchIndex].queryBy ?? '',
      filter_by: this.#filters(builder),
      page,
      per_page: perPage,
      highlight_start_tag: '<mark>',
      highlight_end_tag: '</mark>',
      snippet_threshold: 30,
      exhaustive_search: false,
      use_cache: false,
      prioritize_exact_match: true,
      enable_overrides: true,
      highlight_affix_num_tokens: 4,
    }

    return parameters
  }

  #formatFilterValue(value: any): string {
    if (is.boolean(value)) {
      return value ? 'true' : 'false'
    }
    if (is.number(value)) {
      return value.toString()
    }
    return value
  }

  #filters(builder: Builder): string {
    const filters: string[] = []

    // Handle wheres
    Object.entries(builder.$wheres).forEach(([key, value]) => {
      if (is.array(value)) {
        filters.push(`${key}:${value.map(v => this.#formatFilterValue(v)).join('')}`)
      } else {
        filters.push(`${key}:=${this.#formatFilterValue(value)}`)
      }
    })

    // Handle whereNots
    Object.entries(builder.$whereNots).forEach(([key, value]) => {
      filters.push(`NOT ${key}:=${this.#formatFilterValue(value)}`)
    })

    // Handle whereIns
    Object.entries(builder.$whereIns).forEach(([key, values]) => {
      filters.push(`${key}:=[${values.map(v => this.#formatFilterValue(v)).join(', ')}]`)
    })

    return filters.join(' && ')
  }

  async #getOrCreateCollectionFromModel(model: SearchableModel): Promise<Collection.default> {
    const collectionName = model.$searchIndex
    const collection = this.#client.collections(collectionName)

    const schema = {
      ...this.#config.collectionSettings[collectionName],
      name: collectionName,
    }

    if (await collection.exists()) {
      return collection
    }

    await this.#client.collections().create(schema)

    return collection
  }
}
