import {createStep, StepResponse} from "@medusajs/framework/workflows-sdk"
import {INVOICE_MODULE} from "../../modules/invoice"
import InvoiceModuleService from "../../modules/invoice/service"
import {deleteStoredFile, storePrivatePdf} from "../../utils/store-invoice-file"

type ReplaceInvoicePdfStepInput = {
  invoice_id: string
  file_name: string
  data: string
}

export const replaceInvoicePdfStep = createStep(
  "replace-invoice-pdf-step",
  async (
    {invoice_id, file_name, data}: ReplaceInvoicePdfStepInput,
    {container}
  ) => {
    const invoiceModule: InvoiceModuleService = container.resolve(INVOICE_MODULE)

    const invoice = await invoiceModule.retrieveInvoice(invoice_id)
    const previousFileId = invoice.pdf_url ?? null

    const file = await storePrivatePdf(container, `invoices/${file_name}`, data)

    await invoiceModule.updateInvoices({id: invoice_id, pdf_url: file.id})

    return new StepResponse(file.id, {
      invoice_id,
      file_id: file.id,
      previous_file_id: previousFileId,
    })
  },
  async (
    rollbackData:
      | {invoice_id: string; file_id: string; previous_file_id: string | null}
      | undefined,
    {container}
  ) => {
    if (!rollbackData) return
    const {invoice_id, file_id, previous_file_id} = rollbackData

    const invoiceModule: InvoiceModuleService = container.resolve(INVOICE_MODULE)

    await invoiceModule.updateInvoices({
      id: invoice_id,
      pdf_url: previous_file_id,
    })

    // Clean up the newly uploaded file, it is no longer referenced.
    await deleteStoredFile(container, file_id)
  }
)
