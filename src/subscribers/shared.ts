import {ContainerRegistrationKeys} from "@medusajs/framework/utils"
import invoiceOrderLink from "../links/invoice-order"
import {createInvoiceWorkflow} from "../workflows/create-invoice"
import {INVOICE_MODULE} from "../modules/invoice"
import InvoiceModuleService from "../modules/invoice/service"

export async function createInvoiceIfNotExists(
  container,
  orderId: string,
  optionName: "captureOnPayment" | "captureOnFulfillment"
) {
  const logger = container.resolve("logger")

  const invoiceModule: InvoiceModuleService = container.resolve(INVOICE_MODULE)
  const options = invoiceModule.getOptions()

  if (!options[optionName]) {
    logger.info(`[invoice] ${optionName} is disabled, skipping`)
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {data: existing} = await query.graph({
    entity: invoiceOrderLink.entryPoint,
    fields: ["invoice_id"],
    filters: {order_id: orderId},
  })

  if (existing.length > 0) {
    logger.info(
      `[invoice] Invoice already exists for order ${orderId}, skipping`
    )
    return
  }

  await createInvoiceWorkflow(container).run({
    input: {order_id: orderId},
  })

  logger.info(`[invoice] Created invoice for order ${orderId}`)
}
