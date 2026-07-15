import {pipeline} from "stream/promises"
import {AuthenticatedMedusaRequest, MedusaResponse} from "@medusajs/framework/http"
import {ContainerRegistrationKeys, MedusaError, Modules} from "@medusajs/framework/utils"
import {InvoiceDTO} from "../../../../../types"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const {id} = req.params
  const customerId = req.auth_context.actor_id

  const orderModuleService = req.scope.resolve(Modules.ORDER)
  const order = await orderModuleService.retrieveOrder(id, {select: ["id", "customer_id"]})

  if (!order.customer_id || order.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Unauthorized")
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {data: [orderData]} = await query.graph({
    entity: "order",
    fields: ["invoices.*"],
    filters: {id},
  })

  const creditInvoice = orderData?.invoices?.find((inv: {type: string}) => inv.type === "credit") as InvoiceDTO | undefined

  if (creditInvoice?.pdf_url) {
    const fileModuleService = req.scope.resolve(Modules.FILE)

    const stream = await fileModuleService.getDownloadStream(creditInvoice.pdf_url)
    res.contentType("application/pdf")
    res.attachment(`credit-invoice-${creditInvoice.display_id}.pdf`)

    try {
      await pipeline(stream, res)
    } catch {
      if (!res.headersSent) {
        res.status(500).json({message: "Failed to stream credit invoice"})
      }
    }

    return
  }

  res.status(404).json({message: "Credit invoice PDF not available"})
}
