import {defineMiddlewares} from "@medusajs/framework/http"
import {authenticate} from "@medusajs/medusa"
import multer from "multer"

// Files are kept in memory, they are passed to the file module as base64.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
})

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/orders/:id/invoice",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      methods: ["POST"],
      matcher: "/admin/orders/:id/invoice/:invoice_id/upload",
      middlewares: [upload.single("file")],
    },
  ],
})
