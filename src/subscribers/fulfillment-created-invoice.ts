import {SubscriberArgs, SubscriberConfig} from "@medusajs/framework"
import {createInvoiceIfNotExists} from "./shared"

type FulfillmentCreatedData = {
  order_id: string
  fulfillment_id: string
  no_notification: boolean
}

export default async function fulfillmentCreatedInvoiceHandler({
  event: {data},
  container,
}: SubscriberArgs<FulfillmentCreatedData>) {
  const logger = container.resolve("logger")
  const {order_id} = data

  try {
    await createInvoiceIfNotExists(container, order_id, "captureOnFulfillment")
  } catch (error) {
    logger.error(
      `[invoice] Failed to create invoice for order ${order_id}: ${error.message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
}
