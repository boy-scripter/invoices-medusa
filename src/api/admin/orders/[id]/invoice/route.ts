import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {MedusaError, Modules} from "@medusajs/framework/utils"
import {createInvoiceWorkflow} from "../../../../../workflows/create-invoice"
import {
  findInvoiceByType,
  getOrderInvoiceLinks,
} from "../../../../../utils/order-invoices"

/**
 * Manually creates a (debit) invoice for an order.
 *
 * Useful when the automatic invoice creation is disabled or did not run yet.
 * The invoice, its PDF and the file storage are handled by the existing
 * `createInvoiceWorkflow`.
 *
 * An order can only have one debit invoice, so the request is rejected when
 * the order already has one.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {id: orderId} = req.params

  const orderModuleService = req.scope.resolve(Modules.ORDER)

  try {
    await orderModuleService.retrieveOrder(orderId)
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order ${orderId} not found`
    )
  }

  const links = await getOrderInvoiceLinks(req.scope, orderId)
  const existingInvoice = findInvoiceByType(links, "debit")

  if (existingInvoice) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `This order already has an invoice (#${existingInvoice.invoice?.display_id})`
    )
  }

  const {result} = await createInvoiceWorkflow(req.scope).run({
    input: {
      order_id: orderId,
    },
  })

  res.status(200).json({
    id: result.invoice.id,
    display_id: result.invoice.display_id,
    type: result.invoice.type,
  })
}
