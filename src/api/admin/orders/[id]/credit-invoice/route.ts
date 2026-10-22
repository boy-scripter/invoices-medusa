import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {MedusaError, Modules} from "@medusajs/framework/utils"
import {createCreditInvoiceWorkflow} from "../../../../../workflows/create-credit-invoice"
import {createInvoiceWorkflow} from "../../../../../workflows/create-invoice"
import {
  findInvoiceByType,
  getOrderInvoiceLinks,
  getOrderRefunds,
  hasInvoiceForResource,
} from "../../../../../utils/order-invoices"

/**
 * Manually creates a credit invoice for an order.
 *
 * A credit invoice is always based on a refund. When no `refund_id` is given
 * the most recent refund of the order is used. When the order has no debit
 * invoice yet, one is created first so the credit invoice has a parent
 * invoice to reference.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {id: orderId} = req.params
  const {refund_id: refundId} = (req.body ?? {}) as {refund_id?: string}

  const orderModuleService = req.scope.resolve(Modules.ORDER)

  try {
    await orderModuleService.retrieveOrder(orderId)
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order ${orderId} not found`
    )
  }

  const refunds = await getOrderRefunds(req.scope, orderId)

  if (!refunds.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Order has no refunds, a credit invoice cannot be created"
    )
  }

  const refund = refundId
    ? refunds.find((r) => r.id === refundId)
    : refunds[refunds.length - 1]

  if (!refund) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Refund ${refundId} not found on order ${orderId}`
    )
  }

  const links = await getOrderInvoiceLinks(req.scope, orderId)

  if (hasInvoiceForResource(links, refund.id)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A credit invoice already exists for this refund"
    )
  }

  let parentInvoice = findInvoiceByType(links, "debit")

  // A credit invoice needs a parent invoice to reference. Create the debit
  // invoice first when it does not exist yet.
  let parentInvoiceCreated = false
  if (!parentInvoice) {
    const {result} = await createInvoiceWorkflow(req.scope).run({
      input: {
        order_id: orderId,
      },
    })

    parentInvoice = {invoice_id: result.invoice.id}
    parentInvoiceCreated = true
  }

  const {result} = await createCreditInvoiceWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      resource_id: refund.id,
      parent_invoice_id: parentInvoice.invoice_id,
    },
  })

  res.status(200).json({
    id: result.invoice.id,
    display_id: result.invoice.display_id,
    type: result.invoice.type,
    refund_id: refund.id,
    parent_invoice_created: parentInvoiceCreated,
  })
}
