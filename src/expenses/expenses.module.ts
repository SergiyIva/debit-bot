import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module.js';
import { SheetsModule } from '../sheets/sheets.module.js';
import { ExpensesService } from './expenses.service.js';

@Module({
  imports: [LlmModule, SheetsModule],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
