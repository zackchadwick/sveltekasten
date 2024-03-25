import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { feedBodySchema } from "./schema.js"
import { getCookie } from "hono/cookie"
import { verifyJwt } from "../../../lib/jwt.js"
import { actions } from "../../../lib/constants.js"
import { queue } from "../../../plugins/queue.js"

const api = new Hono()

console.log("jwtArgs", {
  secret: process.env.JWT_SECRET!,
  cookie: process.env.NODE_ENV !== "production" ? "authjs.session-token" : "__Secure-authjs.session-token",
  alg: "HS512",
})

api.get("/", async (c) => {
  try {
    const queueList = queue.getQueue()

    return c.json({ queueList })
  } catch (e) {
    return c.json({ error: e }, 500)
  }
})

api.post("/", feedBodySchema, async (c) => {
  try {
    // TODO: Extract to reusable middleware
    const cookieName = process.env.NODE_ENV !== "production" ? "authjs.session-token" : "__Secure-authjs.session-token"
    const cookie = getCookie(c, cookieName)!
    const decodedJwt = await verifyJwt(cookie)
    console.log("cookie", { decodedJwt })

    const { feedUrl } = c.req.valid("json")

    if (!feedUrl || !decodedJwt?.sub) {
      throw new HTTPException(500, { message: "Failed to add feed, missing inputs" })
    }

    await queue.push({
      action: actions.ADD_FEED,
      data: {
        feedUrl,
        userId: decodedJwt.sub,
      },
    })
    return c.text("ok")
  } catch (error) {
    console.error(error)
    return c.json(error)
  }
})

export default api
