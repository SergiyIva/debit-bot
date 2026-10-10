import { Module } from '@nestjs/common';
import { SheetsService } from './sheets.service.js';
import { SheetsSortService } from './sheets-sort.service.js';

@Module({
  providers: [SheetsService, SheetsSortService],
  exports: [SheetsService],
})
export class SheetsModule {}
