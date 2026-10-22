import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {MedusaError} from "@medusajs/framework/utils"
import {INVOICE_MODULE} from "../../../../../../../modules/invoice"
import InvoiceModuleService from "../../../../../../../modules/invoice/service"
import {uploadInvoicePdfWorkflow} from "../../../../../../../workflows/upload-invoice-pdf"
import {
  getOrderInvoiceLinks,
} from "../../../../../../../utils/order-invoices"

type UploadedFile = {
  originalname: string
  mimetype: string
  buffer: Buffer
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * Uploads a PDF for an existing invoice. The uploaded file replaces the
 * generated PDF of the invoice, nothing else about the invoice changes.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {id: orderId, invoice_id: invoiceId} = req.params

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

  const invoiceModule: InvoiceModuleService = req.scope.resolve(INVOICE_MODULE)

  let invoice
  try {
    invoice = await invoiceModule.retrieveInvoice(invoiceId)
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Invoice ${invoiceId} not found`
    )
  }

  // Make sure the invoice actually belongs to the given order.
  const links = await getOrderInvoiceLinks(req.scope, orderId)

  if (!links.some((link) => link.invoice_id === invoiceId)) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Invoice ${invoiceId} not found on order ${orderId}`
    )
  }

  const fileName = `${
    invoice.type === "credit" ? "credit-" : ""
  }invoice-${invoice.display_id}.pdf`

  await uploadInvoicePdfWorkflow(req.scope).run({
    input: {
      invoice_id: invoiceId,
      file_name: fileName,
      data: file.buffer.toString("base64"),
    },
  })

  res.status(200).json({
    id: invoiceId,
    display_id: invoice.display_id,
    file_name: fileName,
  })
}
