import {MedusaService} from "@medusajs/framework/utils"
import Invoice from "./models/invoice"
import {z} from "@medusajs/framework/zod"
import {Content} from "pdfmake/interfaces"
import {SUPPORTED_LOCALES} from "../../i18n"

type AddressFormatter = (data: Record<string, string>) => string

const addressFormatterSchema = z.custom<AddressFormatter>(
  (value): value is AddressFormatter => typeof value === "function",
  {
    message: "address must be a function",
  }
)

export const moduleOptionsSchema = z.object({
  defaultLocale: z.enum(SUPPORTED_LOCALES).optional(),
  captureOnPayment: z.boolean().default(true),
  captureOnFulfillment: z.boolean().default(true),
  addressInfo: z
    .object({
      companyLogo: z.string().optional(),
      companyLogoWidth: z.number().optional(),
      companyName: z.string().optional(),
      address: addressFormatterSchema.optional(),
      cocNumber: z.string().optional(),
      vatNumber: z.string().optional(),
      iban: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  colors: z
    .object({
      background: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
  header: z.custom<Content>().optional(),
  footer: z.custom<Content>().optional(),
})

type ModuleOptionsInput = z.infer<typeof moduleOptionsSchema>

export type ModuleOptions = Omit<
  ModuleOptionsInput,
  "addressInfo" | "defaultLocale"
> & {
  defaultLocale?: ModuleOptionsInput["defaultLocale"]
  addressInfo: {
    companyLogo?: string
    companyLogoWidth?: number
    companyName: string
    address: AddressFormatter
    cocNumber: string
    vatNumber: string
    iban: string
    email: string
  }
}

const defaultAddress: AddressFormatter = () => {
  const lines = [
    process.env.COMPANY_ADDRESS_LINE_1 || "",
    process.env.COMPANY_ADDRESS_LINE_2 || "",
    `${process.env.COMPANY_POSTAL_CODE || ""} ${process.env.COMPANY_CITY || ""}`.trim(),
  ].filter((line) => line.trim().length > 0)
  return lines.join("\n")
}

const envNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return value !== undefined && value !== "" && Number.isFinite(parsed)
    ? parsed
    : fallback
}

const resolveDefaultLocale = (
  input: ModuleOptionsInput["defaultLocale"]
): ModuleOptions["defaultLocale"] => {
  if (input) {
    return input
  }
  const env = process.env.INVOICE_DEFAULT_LOCALE
  if (
    typeof env === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(env)
  ) {
    return env as ModuleOptions["defaultLocale"]
  }
  return undefined
}

const resolveAddressInfo = (
  input: ModuleOptionsInput["addressInfo"]
): ModuleOptions["addressInfo"] => ({
  companyLogo: input?.companyLogo ?? process.env.COMPANY_LOGO ?? undefined,
  companyLogoWidth:
    input?.companyLogoWidth ??
    envNumber(process.env.COMPANY_LOGO_WIDTH, 110),
  companyName: input?.companyName ?? process.env.COMPANY_NAME ?? "",
  address: input?.address ?? defaultAddress,
  cocNumber: input?.cocNumber ?? process.env.COMPANY_COC_NUMBER ?? "",
  vatNumber: input?.vatNumber ?? process.env.COMPANY_GSTIN ?? "",
  iban: input?.iban ?? process.env.COMPANY_IBAN ?? "",
  email: input?.email ?? process.env.COMPANY_EMAIL ?? "",
})

class Service extends MedusaService({Invoice}) {
  protected options_: ModuleOptions

  constructor(container, options: ModuleOptionsInput) {
    super(container, options)
    this.options_ = {
      ...options,
      defaultLocale: resolveDefaultLocale(options?.defaultLocale),
      addressInfo: resolveAddressInfo(options?.addressInfo),
    }
  }

  getOptions(): ModuleOptions {
    return this.options_
  }
}

export default Service
