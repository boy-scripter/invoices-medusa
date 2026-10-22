import {Modules} from "@medusajs/framework/utils"

/**
 * Stores a PDF in the file module as a private file and returns the created
 * file. The file id is the storage key (e.g. "invoices/invoice-42.pdf").
 */
export async function storePrivatePdf(
  container,
  fileName: string,
  base64Content: string
) {
  const fileModuleService = container.resolve(Modules.FILE)

  const [file] = await fileModuleService.createFiles([
    {
      filename: fileName,
      mimeType: "application/pdf",
      content: base64Content,
      access: "private",
    },
  ])

  return file
}

/**
 * Removes a stored file. Missing files are ignored.
 */
export async function deleteStoredFile(container, fileId: string) {
  if (!fileId) {
    return
  }

  const fileModuleService = container.resolve(Modules.FILE)

  try {
    await fileModuleService.deleteFiles([fileId])
  } catch {
    // The file might have been removed already.
  }
}
