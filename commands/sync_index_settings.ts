import 'reflect-metadata'
import { inject } from '@adonisjs/core'
import { BaseCommand } from '@adonisjs/core/ace'
import { MagnifyEngine } from '../src/engines/main.js'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class SyncIndexSettings extends BaseCommand {
  static commandName = 'magnify:sync-index-settings'
  static description = 'Sync your configured index settings with your search engine (Meilisearch)'

  static options: CommandOptions = {
    startApp: true,
  }

  @inject()
  async run(): Promise<void> {
    const magnify = await this.app.container.make('magnify')
    const engine = magnify.engine() as MagnifyEngine

    if (!engine.syncIndexSettings) {
      this.logger.error(`The driver "${String(engine)}" does not support updating index settings.`)
      return
    }

    try {
      await engine.syncIndexSettings()
    } catch (error) {
      this.logger.error(error.message)
      return
    }
  }
}
