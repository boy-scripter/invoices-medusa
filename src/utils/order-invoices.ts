import {ContainerRegistrationKeys} from "@medusajs/framework/utils"
import invoiceOrderLink from "../links/invoice-order"

export type OrderInvoiceLink = {
  invoice_id: string
  created_at?: Date | string
  invoice?: {
    id?: string
    resource_id: string
    type: string
    display_id: number
    created_at?: string | Date
  }
}

export type OrderRefund = {
  id: string
  amount: number
  note?: string | null
  created_at?: string | Date
}

/**
 * All invoices that are linked to an order.
 */
export async function getOrderInvoiceLinks(
  container,
  orderId: string
): Promise<OrderInvoiceLink[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {data} = await query.graph({
    entity: invoiceOrderLink.entryPoint,
    fields: [
      "invoice_id",
      "created_at",
      "invoice.id",
      "invoice.resource_id",
      "invoice.type",
      "invoice.display_id",
      "invoice.created_at",
    ],
    filters: {
      order_id: orderId,
    },
  })

  return (data ?? []) as OrderInvoiceLink[]
}

/**
 * The most recent invoice of the given type ("debit" | "credit").
 */
export function findInvoiceByType(
  links: OrderInvoiceLink[],
  type: "debit" | "credit"
): OrderInvoiceLink | undefined {
  return links
    .filter((l) => l.invoice?.type === type)
    .sort(
      (a, b) =>
        new Date(b.invoice?.created_at ?? 0).getTime() -
        new Date(a.invoice?.created_at ?? 0).getTime()
    )[0]
}

/**
 * Whether an invoice already exists for the given resource (a refund id).
 */
export function hasInvoiceForResource(
  links: OrderInvoiceLink[],
  resourceId: string
): boolean {
  return links.some((l) => l.invoice?.resource_id === resourceId)
}

/**
 * All refunds of an order, across all payment collections.
 */
export async function getOrderRefunds(
  container,
  orderId: string
): Promise<OrderRefund[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph(
    {
      entity: "order",
      fields: ["id", "payment_collections.payments.refunds.*"],
      filters: {
        id: orderId,
      },
    },
    {throwIfKeyNotFound: true}
  )

  return (order?.payment_collections ?? [])
    .flatMap((pc) => pc.payments ?? [])
    .flatMap((payment) => payment.refunds ?? []) as OrderRefund[]
}
