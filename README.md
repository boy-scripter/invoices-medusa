# @developerx12/invoices-medusa

A Medusa v2 plugin that automatically generates sequential PDF invoices for orders and credit notes for refunds. PDFs are uploaded to your private file storage bucket and served to customers and admins via presigned URLs.

## Requirements

- Medusa `>= 2.4.0`
- A configured [File Module Provider](https://docs.medusajs.com/resources/infrastructure-modules/file) (e.g. S3/R2) with private bucket support

## Installation

```bash
pnpm add @developerx12/invoices-medusa
```

## Configuration

Register the plugin in `medusa-config.ts`. Every company value falls back
to an environment variable, so the minimal setup is:

```ts
import { defineConfig } from "@medusajs/framework/utils"

export default defineConfig({
  plugins: [
    {
      resolve: "@developerx12/invoices-medusa",
      options: {
        // Optional: accent colors used in table headers
        colors: {
          background: "#004534", // header cell fill (default: #000)
          text: "#ffffff",       // header cell text (default: #fff)
        },
      },
    },
  ],
})
```

Explicit options always override the environment. To override a value, pass
it as before:

```ts
export default defineConfig({
  plugins: [
    {
      resolve: "@developerx12/invoices-medusa",
      options: {
        // Optional: locale to fall back to when order.metadata.locale is absent
        // or not a supported value. Defaults to "en".
        // Env fallback: INVOICE_DEFAULT_LOCALE
        defaultLocale: "en",

        addressInfo: {
          // Optional: inline SVG string or base64 data URL rendered as the
          // default page header when `header` is not provided.
          // Env fallback: COMPANY_LOGO
          companyLogo: "<svg>...</svg>",
          // Optional: rendered width of the logo in points (default: 110)
          // Env fallback: COMPANY_LOGO_WIDTH
          companyLogoWidth: 110,

          // Env fallback: COMPANY_NAME
          companyName: "Acme B.V.",

          // Receives the i18n countries object for the resolved locale so you
          // can include a translated country name in the address block.
          // Default: built from COMPANY_ADDRESS_LINE_1, COMPANY_ADDRESS_LINE_2,
          // COMPANY_POSTAL_CODE and COMPANY_CITY.
          address: (countries) =>
            `Streetname 1\n1234 AB Amsterdam, ${countries.nl}`,

          // Optional (e.g. not used in India).
          // Env fallback: COMPANY_COC_NUMBER
          cocNumber: "12345678",
          // Env fallback: COMPANY_GSTIN
          vatNumber: "NL123456789B01",
          // Optional: only shown on tax-exclusive orders.
          // Env fallback: COMPANY_IBAN
          iban: "NL00BANK0123456789",
          // Env fallback: COMPANY_EMAIL
          email: "billing@example.com",
        },

        // Optional: accent colors used in table headers
        colors: {
          background: "#004534", // header cell fill (default: #000)
          text: "#ffffff",       // header cell text (default: #fff)
        },

        // Optional: pdfmake Content rendered as the page header.
        // Overrides the default logo header when provided.
        header: {
          table: {
            widths: ["*"],
            body: [[{ text: "Acme B.V.", fontSize: 18, alignment: "center" }]],
          },
          layout: "noBorders",
        },

        // Optional: pdfmake Content rendered as the page footer.
        footer: {
          table: {
            widths: ["*"],
            body: [[{ text: "acme.com", alignment: "center" }]],
          },
          layout: "noBorders",
        },
      },
    },
  ],
})
```

### Configuration reference

| Option | Type | Required | Description |
|---|---|---|---|
| `defaultLocale` | `Locale` | No | Fallback locale when `order.metadata.locale` is absent or invalid. Env: `INVOICE_DEFAULT_LOCALE`. Defaults to `"en"`. |
| `addressInfo.companyName` | `string` | No | Company name shown on the invoice. Env: `COMPANY_NAME`. |
| `addressInfo.address` | `(countries: Record<string, string>) => string` | No | Function returning the company address. Receives the i18n country name map for the resolved locale. Default: built from `COMPANY_ADDRESS_LINE_1`, `COMPANY_ADDRESS_LINE_2`, `COMPANY_POSTAL_CODE`, `COMPANY_CITY`. |
| `addressInfo.cocNumber` | `string` | No | Chamber of Commerce number. Env: `COMPANY_COC_NUMBER`. Omit/empty hides the row (e.g. India). |
| `addressInfo.vatNumber` | `string` | No | VAT registration number (GSTIN). Env: `COMPANY_GSTIN`. |
| `addressInfo.iban` | `string` | No | Bank account number, shown on tax-exclusive orders only. Env: `COMPANY_IBAN`. |
| `addressInfo.email` | `string` | No | Billing contact e-mail. Env: `COMPANY_EMAIL`. |
| `addressInfo.companyLogo` | `string` | No | Inline SVG string or data URL rendered as the default page header when `header` is not set. Env: `COMPANY_LOGO`. Remote URLs are ignored. |
| `addressInfo.companyLogoWidth` | `number` | No | Rendered logo width in points. Env: `COMPANY_LOGO_WIDTH`. |
| `colors.background` | `string` | No | Table header fill color (CSS hex). |
| `colors.text` | `string` | No | Table header text color (CSS hex). |
| `header` | `Content` | No | pdfmake content block rendered as page header. Replaces the default logo header. |
| `footer` | `Content` | No | pdfmake content block rendered as page footer. |

## How it works

### Invoice lifecycle

1. **Fulfillment created** — the `order.fulfillment_created` subscriber fires `createInvoiceWorkflow`, which:
   - Creates a **debit** invoice record with an auto-incremented `display_id`
   - Links it to the order via the `invoice_order` link table
   - Generates the PDF and uploads it to the **private** storage bucket
   - Stores the file ID in `invoice.pdf_url`
2. **Refund processed** — `createCreditInvoiceWorkflow` follows the same steps for a **credit** invoice, referencing the original debit invoice as its parent.
3. **Download requested** — the API route resolves `invoice.pdf_url` to a presigned download URL via `fileModuleService.retrieveFile()` and streams the PDF. Invoices without a stored PDF (created before this feature) are generated on-demand as a fallback.

### Invoice numbering

`display_id` is a PostgreSQL auto-increment sequence. Voided invoices (created by workflow compensation on failure) preserve their sequence number to avoid gaps.

### Localization

The PDF language is determined by `order.metadata.locale`. The value is validated against the list of supported locales; if it is absent or unrecognised, `defaultLocale` from the plugin config is used.

Supported locales:

| Value | Language |
|---|---|
| `nl` | Dutch |
| `nl-be` | Dutch (Belgium) — uses Dutch translations |
| `en` | English |
| `de` | German |
| `fr` | French |
| `it` | Italian |

Set the locale on an order at creation time:

```ts
await orderModuleService.updateOrders(orderId, {
  metadata: { locale: "en" },
})
```

## API routes

### Admin

```
GET /admin/orders/:id/invoice/:invoice_id
```

Requires admin authentication. Streams the invoice PDF for download.

```
POST /admin/orders/:id/invoice/:invoice_id
```

Requires admin authentication. Regenerates the invoice PDF.

```
POST /admin/orders/:id/invoice
```

Requires admin authentication. Manually creates a new (debit) invoice for the order, including the PDF. Useful when the automatic invoice creation is disabled or did not run. The invoice is created by the same `createInvoiceWorkflow` that the subscribers use. An order can only have one debit invoice, so the request is rejected when the order already has one.

```
POST /admin/orders/:id/credit-invoice
```

Requires admin authentication. Manually creates a (credit) invoice for the order. A credit invoice is always based on a refund:

- `refund_id` (optional): the refund to credit. When omitted, the most recent refund of the order is used.
- When the order has no debit invoice yet, one is created first so the credit invoice has a parent invoice to reference.
- Fails when a credit invoice already exists for the selected refund.

```json
{ "refund_id": "ref_123" }
```

```
POST /admin/orders/:id/invoice/:invoice_id/upload
```

Requires admin authentication. Uploads a PDF for an existing invoice. The uploaded file **replaces** the generated PDF of the invoice — nothing else about the invoice changes. The request must be `multipart/form-data` with a `file` field (PDF only, max 20MB). The file is stored as a private file in the file module, exactly like the generated PDFs.

### Store

```
GET /store/orders/:id/invoice
```

Requires customer authentication. Returns the **debit** invoice PDF for the order. The order must belong to the authenticated customer.

```
GET /store/orders/:id/credit-invoice
```

Requires customer authentication. Returns the **credit** invoice PDF for the order. Returns 404 if no credit invoice exists.

## Admin widget

The plugin includes an admin widget that displays on the order details page (`order.details.side.before` zone).

**Features:**
- Lists all invoices (debit and credit) for the order
- Shows invoice type with colored badges (gray for debit, green for credit)
- Download button fetches PDF via API and triggers browser download
- Refresh button regenerates the invoice PDF from the order
- Upload button replaces the PDF of an invoice with an uploaded PDF file
- **Generate invoice** button creates the invoice for the order manually. An order can only have one debit invoice, so the button is disabled when the order already has one.
- **Credit invoice** button creates a credit invoice for one of the refunds of the order

## Workflows

The workflows can be called directly from your own subscribers, jobs, or API routes.

```ts
import {
  createInvoiceWorkflow,
  createCreditInvoiceWorkflow,
  generateInvoicePdfWorkflow,
  refreshInvoicePdfWorkflow,
  uploadInvoicePdfWorkflow,
} from "@developerx12/invoices-medusa/workflows"
```

### `createInvoiceWorkflow`

Creates a debit invoice, links it to an order, and generates + uploads the PDF.

```ts
await createInvoiceWorkflow(container).run({
  input: { order_id: "order_01J..." },
})
```

### `createCreditInvoiceWorkflow`

Creates a credit invoice for a refund.

```ts
await createCreditInvoiceWorkflow(container).run({
  input: {
    order_id: "order_01J...",
    resource_id: "refund_01J...",      // refund ID used as resource_id
    parent_invoice_id: "inv_01J...",   // optional: the debit invoice this offsets
  },
})
```

### `generateInvoicePdfWorkflow`

Generates an invoice PDF on-demand and returns it as a base64 string. Useful for attaching to notification emails.

```ts
const { result } = await generateInvoicePdfWorkflow(container).run({
  input: {
    order_id: "order_01J...",
    invoice_id: "inv_01J...", // optional; omit to generate the debit invoice
  },
})

// result.fileName  — e.g. "invoice-42.pdf"
// result.data      — base64-encoded PDF
```

### `refreshInvoicePdfWorkflow`

Regenerates an existing invoice PDF and replaces the stored file.

```ts
const { result } = await refreshInvoicePdfWorkflow(container).run({
  input: {
    order_id: "order_01J...",
    invoice_id: "inv_01J...",
  },
})

// result.file_id — the new file ID
```

### `uploadInvoicePdfWorkflow`

Replaces the PDF of an existing invoice with an externally provided file (e.g. a manually uploaded invoice document).

```ts
const { result } = await uploadInvoicePdfWorkflow(container).run({
  input: {
    invoice_id: "inv_01J...",
    file_name: "invoice-42.pdf",
    data: "<base64 encoded pdf>", // base64-encoded file content
  },
})

// result.file_id — the new file ID
```

## Backfill script

To generate and upload PDFs for invoices created before file storage was introduced:

```bash
# Dry run (default) — shows what would be processed
pnpm medusa exec ./src/scripts/backfill-invoice-pdf-urls.ts

# Execute
pnpm medusa exec ./src/scripts/backfill-invoice-pdf-urls.ts -- dry_run=false

# Smaller batches if memory is a concern
pnpm medusa exec ./src/scripts/backfill-invoice-pdf-urls.ts -- dry_run=false batch_size=10
```
