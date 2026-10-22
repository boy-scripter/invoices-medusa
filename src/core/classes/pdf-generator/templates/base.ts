import {Content, TDocumentDefinitions} from "pdfmake/interfaces"
import {ModuleOptions} from "../../../../modules/invoice/service"

const defaultHeader = (options: ModuleOptions): Content | undefined => {
  if (options.header) {
    return options.header
  }
  const logo = options.addressInfo.companyLogo?.trimStart()
  if (!logo) {
    return undefined
  }
  const width = options.addressInfo.companyLogoWidth ?? 110
  if (logo.startsWith("<svg")) {
    return {
      svg: options.addressInfo.companyLogo,
      width,
      alignment: "left",
      margin: [40, 20, 40, 0],
    } as Content
  }
  if (logo.startsWith("data:")) {
    return {
      image: options.addressInfo.companyLogo,
      width,
      alignment: "left",
      margin: [40, 20, 40, 0],
    } as Content
  }
  return undefined
}

const base = (
  content: Content | Content[],
  options: ModuleOptions
): TDocumentDefinitions => ({
  pageMargins: [40, 60, 40, 54],
  content,
  header: defaultHeader(options),
  footer: options.footer,
  styles: {
    tableHeader: {
      margin: [0, 7, 0, 5],
      color: options.colors?.text ?? "#fff",
      fillColor: options.colors?.background ?? "#000",
    },
    lineItemStyle: {
      margin: [0, 7, 0, 5],
    },
    priceStyle: {},
    fromPriceStyle: {
      decoration: "lineThrough",
      margin: [0, 0, 0, 0],
    },
  },
  defaultStyle: {
    font: "DejaVuSans",
    lineHeight: 1.25,
    columnGap: 20,
    fontSize: 10,
    color: "#000",
  },
})

export default base
