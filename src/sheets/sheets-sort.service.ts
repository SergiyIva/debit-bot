import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { CronJob } from 'cron';
import { AppConfigService } from '../config/app-config.service.js';
import { SheetsService } from './sheets.service.js';

@Injectable()
export class SheetsSortService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SheetsSortService.name);
  private job?: CronJob;

  constructor(
    private readonly config: AppConfigService,
    private readonly sheets: SheetsService,
  ) {}

  onApplicationBootstrap(): void {
    this.job = CronJob.from({
      cronTime: '0 0 3 * * *',
      timeZone: this.config.timezone,
      waitForCompletion: true,
      onTick: async () => {
        try {
          await this.sheets.sortByDate();
          this.logger.log('Sheet sorted by date (ascending)');
        } catch (error) {
          this.logger.error(`Daily sheet sort failed: ${(error as Error).message}`);
        }
      },
      start: true,
    });
    this.logger.log(`Daily sheet sort scheduled at 03:00 (${this.config.timezone})`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.job?.stop();
  }
}
