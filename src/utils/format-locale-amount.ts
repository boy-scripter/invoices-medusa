const formatLocaleAmount = (amount: number, currencyCode: string, locale?: string) => {
  const code = (currencyCode || "INR").toUpperCase()
  const fmtLocale = locale || (code === "INR" ? "en-IN" : "en-US")
  const formatter = new Intl.NumberFormat(fmtLocale, {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: code,
  })

  return formatter.format(amount)
}

export default formatLocaleAmount
