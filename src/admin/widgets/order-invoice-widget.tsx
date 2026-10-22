import React, {useRef} from "react"
import {AdminOrder, AdminRefund, DetailWidgetProps} from "@medusajs/types"
import {
  Button,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  Text,
  toast,
  Tooltip,
} from "@medusajs/ui"
import {defineWidgetConfig} from "@medusajs/admin-sdk"
import {sdk} from "../lib/sdk"
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {
  ArrowDownTray,
  ArrowPath,
  ArrowUpTray,
  DocumentText,
  ReceiptPercent,
} from "@medusajs/icons"

type Invoice = {
  created_at: string
  deleted_at: string
  id: string
  display_id: string
  pdf_url?: string
  parent_invoice_id: string
  type: "debit" | "credit"
}

type Refund = AdminRefund

type OrderWithInvoices = AdminOrder & {
  invoices: Invoice[]
}

const OrderInvoiceWidget = ({data: order}: DetailWidgetProps<AdminOrder>) => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const {
    data: expandedOrder,
    isLoading,
    isError,
  } = useQuery({
    queryFn: () =>
      sdk.admin.order.retrieve(order.id, {
        fields: "+invoices.*,+payment_collections.payments.refunds.*",
      }),
    queryKey: [order.id, "order_invoices"],
  })

  const refreshInvoice = useMutation({
    mutationFn: (invoiceId: string) =>
      sdk.client.fetch(`/admin/orders/${order.id}/invoice/${invoiceId}`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Invoice PDF regenerated")
      queryClient.invalidateQueries({queryKey: [order.id, "order_invoices"]})
    },
    onError: () => {
      toast.error("Failed to regenerate invoice PDF")
    },
  })

  const downloadInvoice = useMutation({
    mutationFn: async ({
      invoiceId,
      displayId,
      type,
    }: {
      invoiceId: string
      displayId: string
      type: string
    }) => {
      const response = await fetch(
        `/admin/orders/${order.id}/invoice/${invoiceId}`,
        { credentials: "include" }
      )
      if (!response.ok) {
        throw new Error("Download failed")
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${type === "credit" ? "credit-" : ""}invoice-${displayId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    },
    onError: () => {
      toast.error("Failed to download invoice")
    },
  })

  const generateInvoice = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/orders/${order.id}/invoice`, {
        method: "POST",
      }),
    onSuccess: (result: any) => {
      toast.success(`Invoice #${result?.display_id} generated`)
      queryClient.invalidateQueries({queryKey: [order.id, "order_invoices"]})
    },
    onError: (error: any) => {
      toast.error(
        error?.message ??
          error?.response?.data?.message ??
          "Failed to generate invoice"
      )
    },
  })

  const generateCreditInvoice = useMutation({
    mutationFn: (refundId?: string) =>
      sdk.client.fetch(`/admin/orders/${order.id}/credit-invoice`, {
        method: "POST",
        body: refundId ? {refund_id: refundId} : {},
      }),
    onSuccess: (result: any) => {
      toast.success(`Credit invoice #${result?.display_id} generated`)
      queryClient.invalidateQueries({queryKey: [order.id, "order_invoices"]})
    },
    onError: (error: any) => {
      toast.error(
        error?.message ??
          error?.response?.data?.message ??
          "Failed to generate credit invoice"
      )
    },
  })

  const uploadInvoice = useMutation({
    mutationFn: async ({
      invoiceId,
      file,
    }: {
      invoiceId: string
      file: File
    }) => {
      const formData = new FormData()
      formData.append("file", file)

      const headers: Record<string, string> = {}

      try {
        const token = await sdk.client.getToken()
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }
      } catch {
        // Fall back to the session cookie
      }

      const response = await fetch(
        `/admin/orders/${order.id}/invoice/${invoiceId}/upload`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
          headers,
        }
      )

      if (!response.ok) {
        let message = "Failed to upload invoice PDF"
        try {
          const body = await response.json()
          message = body?.message ?? message
        } catch {
          // Keep the default message
        }
        throw new Error(message)
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success("Invoice PDF uploaded")
      queryClient.invalidateQueries({queryKey: [order.id, "order_invoices"]})
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "Failed to upload invoice PDF")
    },
  })

  const orderWithInvoices = expandedOrder?.order as
    | OrderWithInvoices
    | undefined

  const orderHasInvoices = (orderWithInvoices?.invoices?.length ?? 0) > 0
  const invoices = orderWithInvoices?.invoices

  const hasDebitInvoice =
    invoices?.some((invoice) => invoice.type === "debit") ?? false

  const refunds: Refund[] = (orderWithInvoices?.payment_collections ?? [])
    .flatMap((pc) => pc.payments ?? [])
    .flatMap((payment) => payment.refunds ?? [])

  const formatAmount = (amount: number) => {
    try {
      const formatter = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: order.currency_code,
      })

      const fractionDigits =
        formatter.resolvedOptions().maximumFractionDigits ?? 2

      return formatter.format(amount / Math.pow(10, fractionDigits))
    } catch {
      return (amount / 100).toFixed(2)
    }
  }

  const openFilePicker = (invoiceId: string) => {
    uploadTargetRef.current = invoiceId
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const invoiceId = uploadTargetRef.current

    if (!file || !invoiceId) {
      return
    }

    if (file.type && file.type !== "application/pdf") {
      toast.error("Only PDF files are supported")
      return
    }

    uploadInvoice.mutate({invoiceId, file})
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between gap-2 px-6 py-4">
          <div>
            <Heading level="h1">Invoices</Heading>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              isLoading={generateInvoice.isPending}
              disabled={hasDebitInvoice}
              onClick={() => generateInvoice.mutate()}
            >
              <DocumentText />
              Generate invoice
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={generateCreditInvoice.isPending}
                  disabled={!refunds.length}
                >
                  <ReceiptPercent />
                  Credit invoice
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                {refunds.map((refund) => (
                  <DropdownMenu.Item
                    key={refund.id}
                    onClick={() => generateCreditInvoice.mutate(refund.id)}
                  >
                    {formatAmount(refund.amount)}
                    {refund.note ? ` - ${refund.note}` : ""}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>
        {hasDebitInvoice || !refunds.length ? (
          <div className="px-6 py-4">
            <Text size="small" className="text-ui-fg-muted">
              {hasDebitInvoice
                ? "This order already has an invoice. Upload a PDF to replace its document."
                : "A credit invoice is created from a refund. This order has no refunds yet."}
            </Text>
          </div>
        ) : null}
        <div className="text-ui-fg-subtle px-6 py-4">
          {isLoading ? (
            <Text size="small" className="text-ui-fg-muted">
              Loading...
            </Text>
          ) : isError ? (
            <Text size="small" className="text-ui-fg-error">
              Failed to load invoices
            </Text>
          ) : orderHasInvoices ? (
            <div className="flex flex-col gap-3">
              {invoices?.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between"
                >
                  <button
                    type="button"
                    className="font-normal font-sans txt-compact-small text-ui-fg-subtle flex items-center gap-2 hover:text-ui-fg-base cursor-pointer bg-transparent border-none p-0"
                    disabled={
                      downloadInvoice.isPending &&
                      downloadInvoice.variables?.invoiceId === invoice.id
                    }
                    onClick={() =>
                      downloadInvoice.mutate({
                        invoiceId: invoice.id,
                        displayId: invoice.display_id,
                        type: invoice.type,
                      })
                    }
                  >
                    <ArrowDownTray />
                    {invoice.display_id}.pdf
                    <span
                      className={`txt-xsmall px-1.5 py-0.5 rounded-base ${
                        invoice.type === "credit"
                          ? "bg-ui-green-10 text-ui-green-700"
                          : "bg-ui-bg-subtle text-ui-fg-muted"
                      }`}
                    >
                      {invoice.type}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <Tooltip content="Upload PDF">
                      <IconButton
                        size="small"
                        variant="transparent"
                        aria-label="Upload invoice PDF"
                        disabled={
                          uploadInvoice.isPending &&
                          uploadInvoice.variables?.invoiceId === invoice.id
                        }
                        onClick={() => openFilePicker(invoice.id)}
                      >
                        <ArrowUpTray />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Regenerate invoice PDF">
                      <IconButton
                        size="small"
                        variant="transparent"
                        aria-label="Regenerate invoice PDF"
                        disabled={
                          refreshInvoice.isPending &&
                          refreshInvoice.variables === invoice.id
                        }
                        onClick={() => refreshInvoice.mutate(invoice.id)}
                      >
                        <ArrowPath />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Text size="small" className="text-ui-fg-muted">
              No invoices found
            </Text>
          )}
        </div>
      </Container>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileSelected}
      />
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderInvoiceWidget
