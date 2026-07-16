import { Scalar } from "@scalar/hono-api-reference"
import { Hono } from "hono"
import { generateSpecs, type OpenApiSpecsOptions, openAPISpecs } from "hono-typebox-openapi"
import { ErrorObjectT, ErrorResponseT, InnerErrorT } from "./utils/errors/error.serializer"
import v1 from "./v1"
import admin from "./admin"

const spec: OpenApiSpecsOptions = {
  documentation: {
    info: {
      title: "Internal API",
      version: "1.0.0",
      description: "Internal API",
    },
    servers: [{ url: "http://localhost:3000", description: "Local Server" }],
    components: {
      schemas: {
        InnerErrorT,
        ErrorObjectT,
        ErrorResponseT,
      },
    },
  },
}

const app = new Hono().basePath("/api")
if (process.env.NODE_ENV === "development") {
  app.get(
    "/openapi",
    openAPISpecs(app, {
      ...spec,
      exclude: /^\/api\/admin(?:\/|$).*/,
    }),
  )
  app.get(
    "/admin-openapi",
    openAPISpecs(app, {
      ...spec,
      exclude: /^(?!\/api\/admin(?:\/|$)).*/,
    }),
  )
  app.get(
    "/docs",
    Scalar(() => {
      return {
        url: "/api/openapi",
        theme: "saturn",
      }
    }),
  )
  app.get(
    "/admin-docs",
    Scalar(() => {
      return {
        url: "/api/admin-openapi",
        theme: "saturn",
      }
    }),
  )
}

const routes = app.route("", v1).route("", admin)

export default app
export type AppType = typeof routes

if (process.argv.includes("--openapi")) {
  generateSpecs(app, spec)
    .then((specs) => {
      console.log(JSON.stringify(specs, null, 2))
      // BullMQ queues imported by routes hold Valkey connections that keep the
      // event loop alive, so the CLI must exit explicitly.
      process.exit(0)
    })
    .catch((err: unknown) => {
      console.error(err)
      process.exit(1)
    })
}
