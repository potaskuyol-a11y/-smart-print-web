/**
 * Bitrix24 REST API helpers (incoming webhook)
 * Webhook URL: BITRIX_WEBHOOK_URL env variable
 */

const WEBHOOK = process.env.BITRIX_WEBHOOK_URL?.replace(/\/$/, '') ?? '';

/**
 * Порядок активных стадий (от самой ранней к поздней).
 * Excel разрешён с индекса 0 (NEED_ANALYSIS и выше).
 * PDF  разрешён с индекса 4 (EXECUTING и выше).
 *
 * Актуальные названия на портале (Воронка продаж, CAT=0):
 *   NEED_ANALYSIS      SORT=5   — Выявление потребности  [добавлена 2026-04-05]
 *   NEW                SORT=10  — Клиент на пресейл
 *   PREPARATION        SORT=20  — Бюджетная оценка
 *   PREPAYMENT_INVOICE SORT=30  — ПИЛОТ/Тестирование
 *   EXECUTING          SORT=40  — Подготовка/согласование КП
 *   FINAL_INVOICE      SORT=50  — Заключение договора
 *   UC_0EI5CM          SORT=60  — Отгрузка
 *   UC_10HZUC          SORT=70  — Акт подписан
 *   UC_GUH39B          SORT=80  — Апсейл
 */
export const ACTIVE_STAGE_ORDER = [
  'NEED_ANALYSIS',      // Выявление потребности
  'NEW',                // Клиент на пресейл
  'PREPARATION',        // Бюджетная оценка
  'PREPAYMENT_INVOICE', // ПИЛОТ/Тестирование
  'EXECUTING',          // Подготовка/согласование КП
  'FINAL_INVOICE',      // Заключение договора
  'UC_0EI5CM',          // Отгрузка
  'UC_10HZUC',          // Акт подписан
  'UC_GUH39B',          // Апсейл
];

/**
 * Стадии, при которых сделка считается закрытой/неактивной.
 * После них нельзя создавать новые расчёты и делать экспорт.
 */
export const INACTIVE_STAGES = ['WON', 'LOSE', 'APOLOGY', '1', '2', '3', '4', '5', '6'];

/** Индекс стадии в активной цепочке (-1 если нет или неактивна) */
export function stageIndex(stageId: string): number {
  return ACTIVE_STAGE_ORDER.indexOf(stageId);
}

/** Сделка активна (не закрыта) */
export function isDealActive(stageId: string): boolean {
  return !INACTIVE_STAGES.includes(stageId);
}

/** Разрешён ли Excel (стадия NEED_ANALYSIS и выше) */
export function canExcel(stageId: string): boolean {
  const idx = stageIndex(stageId);
  return idx >= 0;
}

/** Разрешён ли PDF (стадия EXECUTING и выше, idx=4) */
export function canPdf(stageId: string): boolean {
  const idx = stageIndex(stageId);
  return idx >= 4;
}

// ---------------------------------------------------------------------------
// Low-level helper
// ---------------------------------------------------------------------------

async function b24call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!WEBHOOK) throw new Error('BITRIX_WEBHOOK_URL is not set');

  const url = `${WEBHOOK}/${method}.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    // Таймаут через AbortSignal
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Bitrix24 HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json() as { result: T; error?: string; error_description?: string };

  if (json.error) {
    throw new Error(`Bitrix24 error [${json.error}]: ${json.error_description ?? ''}`);
  }

  return json.result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface B24User {
  ID: string;
  EMAIL: string;
  NAME: string;
  LAST_NAME: string;
}

export interface B24Deal {
  ID: string;
  TITLE: string;
  STAGE_ID: string;
  DATE_CREATE: string;
  ASSIGNED_BY_ID: string;
}

/**
 * Найти пользователя Bitrix24 по email.
 * Возвращает первого найденного или null.
 */
export async function getBitrixUser(email: string): Promise<B24User | null> {
  const result = await b24call<B24User[]>('user.search', {
    FILTER: { EMAIL: email },
  });
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
}

/**
 * Получить список активных сделок пользователя Bitrix24.
 * Возвращает только сделки из ACTIVE_STAGE_ORDER.
 */
export async function getDealsByUser(userId: string): Promise<B24Deal[]> {
  // Запрашиваем сделки, назначенные на пользователя, без фильтра по стадии —
  // фильтруем сами, чтобы точно убрать неактивные.
  const result = await b24call<B24Deal[]>('crm.deal.list', {
    filter: {
      ASSIGNED_BY_ID: userId,
    },
    select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'ASSIGNED_BY_ID'],
    order: { DATE_CREATE: 'DESC' },
  });

  if (!Array.isArray(result)) return [];

  // Оставляем только активные стадии
  return result.filter(d => isDealActive(d.STAGE_ID));
}

/**
 * Получить одну сделку по ID.
 */
export async function getDeal(dealId: string): Promise<B24Deal | null> {
  const result = await b24call<B24Deal>('crm.deal.get', { id: dealId });
  return result ?? null;
}

/**
 * Прикрепить PDF к сделке Bitrix24 через disk.folder.uploadfile
 * (загрузка в папку CRM сделки).
 *
 * @param dealId    - ID сделки
 * @param pdfBase64 - base64-строка содержимого PDF
 * @param filename  - имя файла (например "КП-0042.pdf")
 */
export async function attachPdfToDeal(
  dealId: string,
  pdfBase64: string,
  filename: string
): Promise<{ fileId: string }> {
  // Шаг 1: загружаем файл на диск Bitrix
  const uploaded = await b24call<{ ID: string }>('disk.folder.uploadfile', {
    id: `crm/deal/${dealId}`,          // виртуальная папка сделки
    data: { NAME: filename },
    fileContent: pdfBase64,
  });

  const fileId = uploaded?.ID;
  if (!fileId) throw new Error('Не удалось загрузить файл на Bitrix24 диск');

  // Шаг 2: прикрепляем файл к сделке
  await b24call('crm.deal.update', {
    id: dealId,
    fields: {
      UF_CRM_FILES: [fileId],
    },
  });

  return { fileId };
}
