import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { TelegramService } from './telegram.service.js';

@Module({
  imports: [ExpensesModule],
  providers: [TelegramService],
})
export class TelegramModule {}
