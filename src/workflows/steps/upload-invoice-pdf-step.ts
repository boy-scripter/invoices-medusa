import {createStep, StepResponse} from "@medusajs/framework/workflows-sdk"
import {INVOICE_MODULE} from "../../modules/invoice"
import InvoiceModuleService from "../../modules/invoice/service"
import {deleteStoredFile, storePrivatePdf} from "../../utils/store-invoice-file"

type UploadInvoicePdfStepInput = {
  invoice_id: string
  file_name: string
  data: string
}

export const uploadInvoicePdfStep = createStep(
  "upload-invoice-pdf-step",
  async ({invoice_id, file_name, data}: UploadInvoicePdfStepInput, {container}) => {
    const invoiceModule: InvoiceModuleService = container.resolve(INVOICE_MODULE)

    const file = await storePrivatePdf(container, `invoices/${file_name}`, data)

    await invoiceModule.updateInvoices({id: invoice_id, pdf_url: file.id})

    return new StepResponse(file.id, {invoice_id, file_id: file.id})
  },
  async (
    rollbackData: {invoice_id: string; file_id: string} | undefined,
    {container}
  ) => {
    if (!rollbackData) return
    const {invoice_id, file_id} = rollbackData

    const invoiceModule: InvoiceModuleService = container.resolve(INVOICE_MODULE)

    await invoiceModule.updateInvoices({id: invoice_id, pdf_url: null})
    await deleteStoredFile(container, file_id)
  }
)
