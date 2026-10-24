import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDB } from '@/lib/d1'
import { errorJson, secureJson } from '@/lib/response'
import { getAdminSessionEmail } from '@/lib/admin_auth'

export const dynamic = 'force-dynamic'

type Env = Record<string, unknown>
type D1BatchResult = { results?: Record<string, unknown>[]; success?: boolean; meta?: { changes?: number; last_row_id?: number } }
type D1Statement = { bind(...values: unknown[]): D1Statement; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<{ meta?: { changes?: number; last_row_id?: number } }> }
type D1WithBatch = ReturnType<typeof getDB> & { batch<T = unknown>(statements: D1Statement[]): Promise<D1BatchResult[]> }

async function authorized(request: NextRequest): Promise<{ env: Env; actorId: string } | null> {
  const { env } = await getCloudflareContext({ async: true })
  const record = env as Env
  const actorId = await getAdminSessionEmail(request, record)
  if (!actorId) return null
  return { env: record, actorId }
}

const id = () => crypto.randomUUID()
const text = (value: unknown, max = 180) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null

export async function GET(request: NextRequest) {
  const auth = await authorized(request)
  if (!auth) return errorJson('Unauthorized', 401)
  const db = (auth.env.OMNIPOINT_DB ?? getDB(auth.env)) as ReturnType<typeof getDB>
  const resource = request.nextUrl.searchParams.get('resource') || 'summary'
  try {
    if (resource === 'health') {
      const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'omni_%' ORDER BY name").all<{name:string}>()
      const expected = ['omni_products','omni_retail_sales','omni_retail_sale_lines','omni_stock_movements','omni_agency_transactions','omni_ledger_entries','omni_reconciliation_sessions','omni_audit_events']
      const found = new Set(tables.results.map(row => row.name))
      return secureJson({ ok: expected.every(name => found.has(name)), database: 'Cloudflare D1 / production binding', schemaReady: expected.every(name => found.has(name)), missingTables: expected.filter(name => !found.has(name)), demoData: false })
    }
    if (resource === 'products') {
      const { results } = await db.prepare('SELECT id, sku, name, description, category, cost_price, selling_price, quantity_on_hand, reorder_level, is_active, created_at, updated_at FROM omni_products WHERE is_active = 1 ORDER BY name LIMIT 500').all()
      return secureJson({ products: results, count: results.length, source: 'production-d1' }, { cache: 'private, no-store' })
    }
    if (resource === 'sales') {
      const { results } = await db.prepare('SELECT id, receipt_number, status, currency, subtotal, discount_total, tax_total, total, payment_method, efris_status, actor_id, created_at FROM omni_retail_sales ORDER BY created_at DESC LIMIT 100').all()
      return secureJson({ sales: results, count: results.length, source: 'production-d1' }, { cache: 'private, no-store' })
    }
    if (resource === 'agency') {
      const { results } = await db.prepare('SELECT id, reference, transaction_type, provider, provider_status, amount, commission, currency, actor_id, created_at FROM omni_agency_transactions ORDER BY created_at DESC LIMIT 100').all()
      return secureJson({ transactions: results, count: results.length, source: 'production-d1' }, { cache: 'private, no-store' })
    }
    const [products, sales, agency, ledger] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS count FROM omni_products WHERE is_active = 1').first<{count:number}>(),
      db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM omni_retail_sales WHERE status = 'COMPLETED'").first<{count:number;total:number}>(),
      db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN provider_status = 'SUCCEEDED' THEN amount ELSE 0 END),0) AS volume FROM omni_agency_transactions").first<{count:number;volume:number}>(),
      db.prepare('SELECT COUNT(*) AS count FROM omni_ledger_entries').first<{count:number}>(),
    ])
    return secureJson({ source: 'production-d1', demoData: false, currency: 'UGX', products: products?.count ?? 0, completedSales: sales?.count ?? 0, retailSalesTotal: sales?.total ?? 0, agencyTransactions: agency?.count ?? 0, successfulAgencyVolume: agency?.volume ?? 0, ledgerEntries: ledger?.count ?? 0 })
  } catch (error) {
    console.error('[omnipoint] read failed', error)
    return errorJson('OmniPoint production schema is not ready. No demo data is served.', 503)
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorized(request)
  if (!auth) return errorJson('Unauthorized', 401)
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return errorJson('Invalid JSON body', 400) }
  const actorId = auth.actorId
  const action = text(body.action, 60)
  const db = ((auth.env.OMNIPOINT_DB ?? getDB(auth.env)) as ReturnType<typeof getDB>) as D1WithBatch
  try {
    if (action === 'product.create') {
      const sku = text(body.sku, 80).toUpperCase()
      const name = text(body.name, 180)
      const category = text(body.category, 80) || 'General'
      const description = text(body.description, 1000)
      const cost = integer(body.costPrice)
      const price = integer(body.sellingPrice)
      const quantity = integer(body.quantityOnHand)
      const reorder = integer(body.reorderLevel ?? 0)
      if (!sku || !name || cost === null || price === null || quantity === null || reorder === null) return errorJson('SKU, name and valid non-negative integer prices/stock are required.', 400)
      const productId = id()
      const auditId = id()
      const movementId = id()
      const statements: D1Statement[] = [
        db.prepare('INSERT INTO omni_products (id, sku, name, description, category, cost_price, selling_price, quantity_on_hand, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(productId, sku, name, description || null, category, cost, price, quantity, reorder),
        db.prepare('INSERT INTO omni_stock_movements (id, product_id, actor_id, movement_type, quantity_delta, quantity_after, unit_cost, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(movementId, productId, actorId, 'OPENING', quantity, quantity, cost, 'Opening stock recorded during product creation'),
        db.prepare('INSERT INTO omni_audit_events (id, actor_id, action, entity_type, entity_id, after_state) VALUES (?, ?, ?, ?, ?, ?)').bind(auditId, actorId, 'CREATE', 'product', productId, JSON.stringify({ sku, name, category, costPrice: cost, sellingPrice: price, quantityOnHand: quantity })),
      ]
      await db.batch(statements)
      return secureJson({ ok: true, productId, message: 'Product saved to production database.' }, { status: 201, cache: 'private, no-store' })
    }
    if (action === 'sale.create') {
      const paymentMethod = text(body.paymentMethod, 30).toUpperCase()
      if (paymentMethod !== 'CASH') return errorJson('Only cash sales are enabled. Mobile-money collection is disabled until a verified payment partner is configured.', 400)
      if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) return errorJson('Add between 1 and 50 sale lines.', 400)
      const quantities = new Map<string, number>()
      for (const raw of body.items) {
        if (!raw || typeof raw !== 'object') return errorJson('Invalid sale line.', 400)
        const item = raw as Record<string, unknown>
        const productId = text(item.productId, 80)
        const quantity = Number(item.quantity)
        if (!productId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) return errorJson('Each sale line needs a product and quantity from 1 to 100.', 400)
        quantities.set(productId, (quantities.get(productId) || 0) + quantity)
      }
      const saleProducts = await Promise.all([...quantities.entries()].map(async ([productId, quantity]) => {
        const product = await db.prepare('SELECT id, sku, name, cost_price, selling_price, quantity_on_hand FROM omni_products WHERE id = ? AND is_active = 1').bind(productId).first<{id:string;sku:string;name:string;cost_price:number;selling_price:number;quantity_on_hand:number}>()
        return product ? { product, quantity } : null
      }))
      if (saleProducts.some(item => item === null)) return errorJson('One or more products are unavailable.', 409)
      const lines = saleProducts.filter((item): item is NonNullable<typeof item> => item !== null)
      for (const line of lines) {
        if (line.product.quantity_on_hand < line.quantity) return errorJson('Insufficient stock for ' + line.product.name + '.', 409)
      }
      const subtotal = lines.reduce((sum, line) => sum + line.product.selling_price * line.quantity, 0)
      const costOfGoods = lines.reduce((sum, line) => sum + line.product.cost_price * line.quantity, 0)
      if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(costOfGoods)) return errorJson('Sale total exceeds the supported amount range.', 400)
      const saleId = id()
      const receiptNumber = 'OP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + saleId.slice(0, 8).toUpperCase()
      const statements: D1Statement[] = [
        db.prepare("INSERT INTO omni_retail_sales (id, receipt_number, status, subtotal, discount_total, tax_total, total, cost_of_goods, payment_method, actor_id) VALUES (?, ?, 'COMPLETED', ?, 0, 0, ?, ?, 'CASH', ?)").bind(saleId, receiptNumber, subtotal, subtotal, costOfGoods, actorId),
      ]
      for (const line of lines) {
        statements.push(db.prepare('INSERT INTO omni_retail_sale_lines (id, sale_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id(), saleId, line.product.id, line.product.sku, line.product.name, line.quantity, line.product.selling_price, line.product.cost_price, line.product.selling_price * line.quantity))
      }
      statements.push(
        db.prepare('INSERT INTO omni_ledger_entries (id, ledger_type, account_code, debit, credit, source_type, source_id, idempotency_key, description) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)')
          .bind(id(), 'RETAIL', 'CASH_ON_HAND', subtotal, 'RETAIL_SALE', saleId, saleId + ':cash-debit', 'Cash received for ' + receiptNumber),
        db.prepare('INSERT INTO omni_ledger_entries (id, ledger_type, account_code, debit, credit, source_type, source_id, idempotency_key, description) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)')
          .bind(id(), 'RETAIL', 'RETAIL_SALES_REVENUE', subtotal, 'RETAIL_SALE', saleId, saleId + ':sales-credit', 'Retail revenue for ' + receiptNumber),
      )
      if (costOfGoods > 0) statements.push(
        db.prepare('INSERT INTO omni_ledger_entries (id, ledger_type, account_code, debit, credit, source_type, source_id, idempotency_key, description) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)')
          .bind(id(), 'RETAIL', 'COST_OF_GOODS_SOLD', costOfGoods, 'RETAIL_SALE', saleId, saleId + ':cogs-debit', 'Cost of goods sold for ' + receiptNumber),
        db.prepare('INSERT INTO omni_ledger_entries (id, ledger_type, account_code, debit, credit, source_type, source_id, idempotency_key, description) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)')
          .bind(id(), 'RETAIL', 'INVENTORY', costOfGoods, 'RETAIL_SALE', saleId, saleId + ':inventory-credit', 'Inventory relieved for ' + receiptNumber),
      )
      statements.push(db.prepare('INSERT INTO omni_audit_events (id, actor_id, action, entity_type, entity_id, after_state) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id(), actorId, 'CREATE', 'retail_sale', saleId, JSON.stringify({ receiptNumber, total: subtotal, currency: 'UGX', paymentMethod: 'CASH', lineCount: lines.length })))
      await db.batch(statements)
      return secureJson({ ok: true, saleId, receiptNumber, total: subtotal, currency: 'UGX', status: 'COMPLETED', efrisStatus: 'NOT_CONFIGURED', message: 'Cash sale recorded in production with stock movements and ledger entries.' }, { status: 201, cache: 'private, no-store' })
    }
    if (action === 'stock.adjust') {
      const productId = text(body.productId, 80)
      const delta = Number(body.quantityDelta)
      const reason = text(body.reason, 300)
      const cost = body.unitCost === undefined ? null : integer(body.unitCost)
      if (!productId || !Number.isSafeInteger(delta) || delta === 0 || !reason || (body.unitCost !== undefined && cost === null)) return errorJson('Product, non-zero integer adjustment and reason are required.', 400)
      const product = await db.prepare('SELECT quantity_on_hand, cost_price FROM omni_products WHERE id = ? AND is_active = 1').bind(productId).first<{quantity_on_hand:number;cost_price:number}>()
      if (!product) return errorJson('Product not found.', 404)
      const after = product.quantity_on_hand + delta
      if (after < 0) return errorJson('Adjustment would make stock negative.', 409)
      const auditId = id()
      const batchResults = await db.batch([
        db.prepare('UPDATE omni_products SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND quantity_on_hand = ?').bind(after, productId, product.quantity_on_hand),
        db.prepare('INSERT INTO omni_stock_movements (id, product_id, actor_id, movement_type, quantity_delta, quantity_after, unit_cost, reason) SELECT ?, id, ?, ?, ?, quantity_on_hand, ?, ? FROM omni_products WHERE id = ? AND quantity_on_hand = ?').bind(id(), actorId, 'ADJUSTMENT', delta, cost ?? product.cost_price, reason, productId, after),
        db.prepare('INSERT INTO omni_audit_events (id, actor_id, action, entity_type, entity_id, reason, before_state, after_state) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM omni_products WHERE id = ? AND quantity_on_hand = ?)').bind(auditId, actorId, 'UPDATE', 'stock', productId, reason, JSON.stringify({quantityOnHand: product.quantity_on_hand}), JSON.stringify({quantityOnHand: after}), productId, after),
      ])
      if ((batchResults[0]?.meta?.changes ?? 0) !== 1) return errorJson('Stock changed concurrently. Refresh and try again.', 409)
      return secureJson({ ok: true, productId, quantityOnHand: after, message: 'Stock adjustment recorded.' }, { cache: 'private, no-store' })
    }
    return errorJson('Unsupported action.', 400)
  } catch (error) {
    console.error('[omnipoint] write failed', error)
    const message = String(error)
    if (message.includes('INSUFFICIENT_STOCK')) return errorJson('Stock changed during checkout. Refresh the inventory and try again.', 409)
    if (message.includes('PRODUCT_NOT_AVAILABLE')) return errorJson('A product became unavailable during checkout. Refresh and try again.', 409)
    if (message.includes('UNIQUE')) return errorJson('SKU already exists or the request conflicts with an existing record.', 409)
    return errorJson('Could not save the operation. No demo fallback is used.', 500)
  }
}
