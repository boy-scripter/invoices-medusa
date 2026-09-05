import path from "path"
import pdfmake from "pdfmake"
import packingSlipContent from "./templates/packing-slip-content"
import base from "./templates/base"
import {OrderDTO, PaymentCollectionDTO, PromotionDTO} from "@medusajs/types"
import invoiceContent from "./templates/invoice-content"
import {InvoiceDTO} from "../../../types"
import {ModuleOptions} from "../../../modules/invoice/service"
import creditInvoiceContent from "./templates/credit-invoice-content"

const dejavuRoot = path.join(
  path.dirname(require.resolve("dejavu-fonts-ttf/package.json")),
  "ttf"
)

pdfmake.addFonts({
  DejaVuSans: {
    normal: path.join(dejavuRoot, "DejaVuSans.ttf"),
    bold: path.join(dejavuRoot, "DejaVuSans-Bold.ttf"),
    italics: path.join(dejavuRoot, "DejaVuSans-Oblique.ttf"),
    bolditalics: path.join(dejavuRoot, "DejaVuSans-BoldOblique.ttf"),
  },
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
})

export type OrderWithInvoices = OrderDTO & {invoices: InvoiceDTO[]} & {
  payment_collections: PaymentCollectionDTO[]
} & {promotions: PromotionDTO[]}

export default class PdfGenerator {

  createPackingSlip = async (
    order: OrderDTO,
    options: ModuleOptions
  ): Promise<string> => {
    const content = await packingSlipContent(order, options)
    return pdfmake.createPdf(base(content, options)).getBase64()
  }

  createInvoice = async (
    order: OrderWithInvoices,
    options: ModuleOptions
  ): Promise<string> => {
    const content = await invoiceContent(order, options)
    return pdfmake.createPdf(base(content, options)).getBase64()
  }

  createCreditInvoice = async (
    order: OrderWithInvoices,
    invoice: InvoiceDTO,
    options: ModuleOptions
  ): Promise<string> => {
    const content = await creditInvoiceContent(order, invoice, options)
    return pdfmake.createPdf(base(content, options)).getBase64()
  }
}
