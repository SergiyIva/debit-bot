import { Module } from '@nestjs/common';
import { SheetsService } from './sheets.service.js';

@Module({
  providers: [SheetsService],
  exports: [SheetsService],
})
export class SheetsModule {}
