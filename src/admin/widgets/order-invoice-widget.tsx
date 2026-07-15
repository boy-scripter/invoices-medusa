import React from "react"
import {AdminOrder, DetailWidgetProps} from "@medusajs/types"
import {Container, Heading, IconButton, Text, toast} from "@medusajs/ui"
import {defineWidgetConfig} from "@medusajs/admin-sdk"
import {sdk} from "../lib/sdk"
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowDownTray, ArrowPath} from "@medusajs/icons"

type Invoice = {
  created_at: string
  deleted_at: string
  id: string
  display_id: string
  pdf_url?: string
  parent_invoice_id: string
  type: "debit" | "credit"
}

const OrderInvoiceWidget = ({data: order}: DetailWidgetProps<AdminOrder>) => {
  const queryClient = useQueryClient()
  const {
    data: expandedOrder,
    isLoading,
    isError,
  } = useQuery({
    queryFn: () =>
      sdk.admin.order.retrieve(order.id, {
        fields: "+invoices.*",
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
    mutationFn: async ({invoiceId, displayId, type}: {invoiceId: string; displayId: string; type: string}) => {
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

  const orderWithInvoices = expandedOrder?.order as AdminOrder & {
    invoices: Invoice[]
  }
  const orderHasInvoices = orderWithInvoices?.invoices?.length > 0
  const invoices = orderWithInvoices?.invoices

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Invoices</Heading>
          </div>
        </div>
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
                    disabled={downloadInvoice.isPending && downloadInvoice.variables?.invoiceId === invoice.id}
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
                    <span className={`txt-xsmall px-1.5 py-0.5 rounded-base ${
                      invoice.type === "credit" 
                        ? "bg-ui-green-10 text-ui-green-700" 
                        : "bg-ui-bg-subtle text-ui-fg-muted"
                    }`}>
                      {invoice.type}
                    </span>
                  </button>
                  <IconButton
                    size="small"
                    variant="transparent"
                    disabled={
                      refreshInvoice.isPending &&
                      refreshInvoice.variables === invoice.id
                    }
                    onClick={() => refreshInvoice.mutate(invoice.id)}
                    aria-label="Regenerate invoice PDF"
                  >
                    <ArrowPath />
                  </IconButton>
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
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderInvoiceWidget
