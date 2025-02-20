import { ModelPaginator } from '@adonisjs/lucid/orm'
import { MagnifyEngine } from './engines/main.js'
import { SearchableModel } from './types.js'

export class Builder<Model extends SearchableModel = SearchableModel> {
  /**
   * The fields that should be highlighted in the search results.
   */
  #highlightFields: string[] = []

  /**
   * The custom index specified for the search.
   */
  $index?: string

  /**
   * The query expression.
   */
  $query: string

  /**
   * The model instance.
   */
  $model: Model

  /**
   * The "where" constraints added to the query.
   */
  $wheres: Record<string, any> = {}

  /**
   * The "where not" constraints added to the query.
   */
  $whereNots: Record<string, any> = {}

  /**
   * The "where in" constraints added to the query.
   */
  $whereIns: Record<string, any[]> = {}

  /**
   * The "where not in" constraints added to the query.
   */
  $whereNotIns: Record<string, any[]> = {}

  /**
   * The "limit" that should be applied to the search.
   */
  $limit?: number

  /**
   * The "order" that should be applied to the search.
   */
  $orders: { column: string; direction: 'asc' | 'desc' }[] = []

  constructor(model: any, query: string) {
    this.$model = model
    this.$query = query
  }

  /**
   * Specify a custom index to perform this search on.
   */
  within(index: string): this {
    this.$index = index
    return this
  }

  /**
   * Add a constraint to the search query.
   */
  where(field: string, value: any): this {
    this.$wheres[field] = value
    return this
  }

  /**
   * Add a "where not" constraint to the search query.
   */
  whereNot(field: string, value: any): this {
    this.$whereNots[field] = value
    return this
  }

  /**
   * Add a "where in" constraint to the search query.
   */
  whereIn(field: string, values: any[]): this {
    this.$whereIns[field] = values
    return this
  }

  /**
   * Add a "where not in" constraint to the search query.
   */
  whereNotIn(field: string, values: any[]): this {
    this.$whereNotIns[field] = values
    return this
  }

  /**
   * Set the "limit" for the search query.
   */
  take(limit: number): this {
    this.$limit = limit
    return this
  }

  /**
   * Add an "order" for the search query.
   */
  orderBy(column: string, direction: 'asc' | 'desc') {
    this.$orders.push({
      column,
      direction,
    })

    return this
  }

  /**
   * Specify which fields should be highlighted in the search results.
   */
  highlight(...fields: string[]): this {
    this.#highlightFields = fields
    return this
  }

  /**
   * Get the fields that should be highlighted.
   */
  get $highlightFields(): string[] {
    return this.#highlightFields
  }

  async paginate(page = 1, perPage = 20): Promise<ModelPaginator> {
    return this.$engine.paginate(this, page, perPage)
  }

  /**
   * Add an "order by" clause for a timestamp to the query.
   */
  latest(column = 'createdAt') {
    return this.orderBy(column, 'desc')
  }

  /**
   * Add an "order by" clause for a timestamp to the query.
   */
  oldest(column = 'createdAt') {
    return this.orderBy(column, 'asc')
  }

  get $engine(): MagnifyEngine {
    return this.$model.$searchEngine
  }

  get(): Promise<InstanceType<Model>[]> {
    return this.$engine.get(this)
  }
}
