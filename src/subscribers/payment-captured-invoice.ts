import {SubscriberArgs, SubscriberConfig} from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  PaymentEvents,
} from "@medusajs/framework/utils"
import {createInvoiceIfNotExists} from "./shared"

export default async function paymentCapturedInvoiceHandler({
  event: {data},
  container,
}: SubscriberArgs<{id: string}>) {
  const logger = container.resolve("logger")

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [payment],
    } = await query.graph({
      entity: "payment",
      fields: ["payment_collection.order.id"],
      filters: {id: data.id},
    })

    const orderId = payment?.payment_collection?.order?.id

    if (!orderId) {
      logger.info(`[invoice] No order found for payment ${data.id}, skipping`)
      return
    }

    await createInvoiceIfNotExists(container, orderId, "captureOnPayment")
  } catch (error) {
    logger.error(
      `[invoice] Failed to create invoice for payment ${data.id}: ${error.message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: PaymentEvents.CAPTURED,
}
