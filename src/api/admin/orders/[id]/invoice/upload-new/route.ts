import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {MedusaError, Modules, ContainerRegistrationKeys} from "@medusajs/framework/utils"
import {createInvoiceWorkflow} from "../../../../../../workflows/create-invoice"
import { createCreditInvoiceWorkflow , uploadInvoicePdfWorkflow } from "../../../../../../workflows"
import { findInvoiceByType , getOrderInvoiceLinks , getOrderRefunds } from "../../../../../../utils/order-invoices"

type UploadedFile = {
  originalname: string
  mimetype: string
  buffer: Buffer
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * Uploads a PDF and creates a new invoice (debit or credit) for an order.
 * This is used when you want to upload an externally generated invoice
 * instead of using the built-in PDF generation.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {id: orderId} = req.params
  const {type} = (req.body ?? {}) as {type?: "debit" | "credit"}

  const file = (req as unknown as {file?: UploadedFile}).file

  if (!file?.buffer) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No file was uploaded. Upload a PDF file in the `file` field."
    )
  }

  if (file.buffer.length > MAX_FILE_SIZE) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The uploaded file is too large. The maximum file size is 20MB."
    )
  }

  const isPdf =
    file.mimetype === "application/pdf" ||
    /\.pdf$/i.test(file.originalname ?? "")

  if (!isPdf) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Only PDF files are supported"
    )
  }

  if (!type || (type !== "debit" && type !== "credit")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid invoice type. Must be 'debit' or 'credit'."
    )
  }

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

  if (type === "debit") {
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

    const fileName = `invoice-${result.invoice.display_id}.pdf`

    await uploadInvoicePdfWorkflow(req.scope).run({
      input: {
        invoice_id: result.invoice.id,
        file_name: fileName,
        data: file.buffer.toString("base64"),
      },
    })

    res.status(200).json({
      id: result.invoice.id,
      display_id: result.invoice.display_id,
      type: result.invoice.type,
      file_name: fileName,
    })
  } else {
    // Credit invoice - need to find a refund to associate with
    const refunds = await getOrderRefunds(req.scope, orderId)

    if (!refunds.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Order has no refunds, a credit invoice cannot be created"
      )
    }

    // Find refunds that don't have a credit invoice yet
    const existingCreditInvoices = links.filter((link) => {
      return link.invoice?.type === "credit"
    })
    const refundedIds = existingCreditInvoices.map((link) => link.invoice?.resource_id)
    const availableRefunds = refunds.filter((r) => !refundedIds.includes(r.id))

    if (availableRefunds.length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No available refunds to create a credit invoice for. All refunds already have credit invoices."
      )
    }

    // Use the first available refund
    const refund = availableRefunds[0]

    // Ensure parent invoice exists
    let parentInvoice = findInvoiceByType(links, "debit")
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

    const fileName = `credit-invoice-${result.invoice.display_id}.pdf`

    await uploadInvoicePdfWorkflow(req.scope).run({
      input: {
        invoice_id: result.invoice.id,
        file_name: fileName,
        data: file.buffer.toString("base64"),
      },
    })

    res.status(200).json({
      id: result.invoice.id,
      display_id: result.invoice.display_id,
      type: result.invoice.type,
      file_name: fileName,
      parent_invoice_created: parentInvoiceCreated,
    })
  }
}
