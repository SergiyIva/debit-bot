# Expense Bot

Telegram-бот для учёта личных расходов: принимает текст / голосовые / фото чеков, через OpenRouter LLM извлекает структуру `{дата, назначение, сумма, комментарий}` и дописывает строку в Google-таблицу.

## Стек

- [bun](https://bun.sh) — runtime и менеджер пакетов
- NestJS 11
- grammY + `@grammyjs/files`
- googleapis + google-auth-library
- OpenRouter (multimodal chat completions)
- zod для валидации env и LLM-ответа

## Подготовка

1. **Service account для Google Sheets**
   - Создай service-account в Google Cloud Console.
   - Включи Google Sheets API на проекте.
   - Скачай JSON-ключ.
   - Открой нужную таблицу и расшарь её на `client_email` ключа с правами Editor.

2. **Telegram-бот**
   - Создай бота через [@BotFather](https://t.me/BotFather), забери токен.
   - Узнай свой Telegram user ID (например, через [@userinfobot](https://t.me/userinfobot)) — потребуется для whitelist.

3. **OpenRouter**
   - Получи API-ключ на https://openrouter.ai/.
   - Выбери multimodal-модель, поддерживающую text + image + audio.
     Рекомендация: `google/gemini-2.5-flash` (быстро и дёшево, понимает голос и картинки).

4. **Заполни `.env`** по образцу `.env.example`.

## Запуск

```bash
bun install
bun run dev          # с watch
# или
bun run start
```

При старте бот:
- провалидирует `.env` (упадёт, если что-то не так);
- проверит/создаст заголовки `Дата | Назначение | Сумма | Комментарий` в первой строке листа;
- запустит long polling Telegram.

## Формат таблицы

| Дата     | Назначение | Сумма | Комментарий       |
| -------- | ---------- | ----- | ----------------- |
| 01.05.26 | Кофе       | 250   | по дороге на работу |

- `Дата` — `dd.MM.yy` в часовом поясе из `TZ`.
- `Сумма` — только число, без валюты.
- Если LLM не смог распознать сумму или назначение — бот ответит сообщением об ошибке и **в таблицу ничего не пишет**.

## Скрипты

- `bun run dev` — запуск с автоперезагрузкой (`bun --watch`)
- `bun run start` — запуск без watch
- `bun run typecheck` — проверка типов
- `bun run build` — компиляция в `dist/`
