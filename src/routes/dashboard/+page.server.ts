import prisma from "$lib/prisma"
import { fail, redirect } from "@sveltejs/kit"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = await locals?.auth()

  if (!session && url.pathname !== "/login") {
    const fromUrl = url.pathname + url.search
    redirect(303, `/login?redirectTo=${encodeURIComponent(fromUrl)}`)
  }

  try {
    const session = await locals.auth()
    if (!session?.user?.userId) {
      return fail(401, { type: "error", error: "Unauthenticated" })
    }

    const [feedData, feedCount] = await prisma.feedEntry.findManyAndCount({
      take: 10,
      skip: 0,
      where: {
        userId: session?.user?.userId,
      },
      include: {
        feed: true,
        feedMedia: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const [bookmarkData, bookmarkCount] = await prisma.bookmark.findManyAndCount({
      take: 10,
      skip: 0,
      where: {
        userId: session?.user?.userId,
        archived: false,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return {
      session,
      feedEntries: {
        data: feedData,
        count: feedCount,
      },
      bookmarks: {
        data: bookmarkData,
        count: bookmarkCount,
      },
    }
  } catch (error) {
    let message
    if (typeof error === "string") {
      message = error
    } else if (error instanceof Error) {
      message = error.message
    }
    return { bookmarks: [], count: 1, error: message }
  }
}
