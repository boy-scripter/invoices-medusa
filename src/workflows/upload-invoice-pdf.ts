import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {replaceInvoicePdfStep} from "./steps/replace-invoice-pdf-step"

export type UploadInvoicePdfWorkflowInput = {
  invoice_id: string
  file_name: string
  /**
   * Base64 encoded file content.
   */
  data: string
}

/**
 * Replaces the PDF of an existing invoice with an externally provided file
 * (e.g. a manually uploaded invoice document).
 */
export const uploadInvoicePdfWorkflow = createWorkflow(
  "upload-invoice-pdf",
  function (input: UploadInvoicePdfWorkflowInput) {
    const fileId = replaceInvoicePdfStep(input)

    return new WorkflowResponse({file_id: fileId})
  }
)
