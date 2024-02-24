import prisma from "$lib/prisma"
import { fail, redirect } from "@sveltejs/kit"
import type { PageServerLoad } from "./$types"
import type { Feed } from "$zod"

export const load: PageServerLoad = async ({ locals, url }) => {
  try {
    const session = await locals.auth()
    if (!session && url.pathname !== "/login") {
      const fromUrl = url.pathname + url.search
      redirect(303, `/login?redirectTo=${encodeURIComponent(fromUrl)}`)
    }
    const skip = Number(url.searchParams.get("skip") ?? "0")
    const limit = Number(url.searchParams.get("limit") ?? "20")

    if (limit > 100) {
      return fail(401, { type: "error", error: "Attempted to load too many items" })
    }

    const [feedEntryData, feedEntryCount] = await prisma.feedEntry.findManyAndCount({
      take: limit,
      skip: skip,
      where: { userId: session?.user?.id },
      include: {
        feed: true,
        feedMedia: true,
      },
      orderBy: { published: "desc" },
    })

    const [feedData, feedCount] = await prisma.feed.findManyAndCount({
      where: { userId: session?.user?.id },
      select: {
        id: true,
        name: true,
        url: true,
        description: true,
        language: true,
        userId: true,
        lastFetched: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            feedEntries: { where: { unread: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return {
      session,
      feedEntries: {
        data: feedEntryData,
        count: feedEntryCount,
      },
      feeds: {
        data: feedData.map((feed) => {
          return {
            ...feed,
            visible: true,
          } as unknown as Feed & { visible: boolean }
        }),
        count: feedCount,
      },
    }
  } catch (error: any) {
    return {
      feedEntries: [],
      count: 0,
      error: error.message ?? error,
    }
  }
}
