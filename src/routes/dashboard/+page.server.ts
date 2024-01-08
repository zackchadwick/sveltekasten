import prisma from "$lib/prisma";
import { dev } from "$app/environment"
import type { Actions } from "./$types"
import type { PageServerLoad } from './$types'
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms/server";
import { formSchema } from "../schema";

export const actions: Actions = {
  deleteBookmark: async ({ request, locals }) => {
    const session = await locals.getSession()
    if (!session?.user?.userId) {
      return fail(401, { type: "error", error: "Unauthenticated" })
    }
    const data = await request.formData();
    const bookmarkId = data.get('bookmarkId')?.toString() || ''

    if (!bookmarkId) {
      return fail(400)
    }

    await prisma.bookmark.delete({
      where: {
        id: bookmarkId,
        userId: session.user.userId,
      }
    });
    return { type: "success", message: 'Deleted Bookmark' }
  },
  saveMetadataEdits: async ({ request, locals }) => {
    const session = await locals.getSession()
    if (!session?.user?.userId) {
      return fail(401, { type: "error", error: "Unauthenticated" })
    }
    const data = await request.formData();

    const id = data.get('id')?.toString() || ''
    const title = data.get('title')?.toString() || ''
    const url = data.get('url')?.toString() || ''
    const desc = data.get('description')?.toString() || ''
    const categoryId = data.get('categoryId')?.toString() || ''
    // @TODO: Support updating image
    // const image = data.get('image')?.toString() || ''

    if (!id) {
      return fail(400, { type: 'error', message: 'Missing bookmark id' })
    }

    await prisma.bookmark.update({
      data: {
        title,
        desc,
        url,
        categoryId,
      },
      where: {
        id,
        userId: session.user.userId,
      }
    });

    return { type: "success", message: 'Updated Bookmark' }
  },
  quickAdd: async (event) => {
    const form = await superValidate(event, formSchema);
    if (!form.valid) {
      return fail(400, {
        form
      });
    }

    try {
      const session = await event.locals.getSession()
      if (!session?.user?.userId) {
        return fail(401, { type: "error", error: "Unauthenticated" })
      }
      const { userId } = session.user
      const { title, url, description, categoryId, tags } = form.data

      const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&palette=true`)
      const metadataResponse = await res.json()
      const metadata = metadataResponse.data

      dev && console.log('quickAdd.url.metadataResponse', metadata)

      const upsertBookmarkRes = await prisma.bookmark.upsert({
        include: {
          category: true,
        },
        create: {
          url,
          title: title,
          image: metadata.image?.url ? metadata.image.url : metadata.logo?.url,
          desc: description?.length ? description : metadata.description,
          metadata,
          user: {
            connect: {
              id: userId,
            },
          },
          category: categoryId
            ? {
              connect: {
                id: categoryId,
              },
            }
            : {},
        },
        update: {
          url,
          // title: title.length ? title : metadata.title,
          // image: metadata.image,
          // imageBlur: metadata.imageBlur,
          // desc: desc.length ? desc : metadata.description,
          title,
          metadata,
          desc: description,
          category: categoryId
            ? {
              connect: {
                id: categoryId,
              },
            }
            : {},
        },
        where: { url_userId: { url: url, userId: userId } },
      })

      let upsertTagRes
      // Next, if there are tags, insert them sequentially
      if (tags && tags.filter(Boolean).length) {
        upsertTagRes = await Promise.all(
          tags.map(async (tag) => {
            return await prisma.tag.upsert({
              create: {
                name: tag,
                userId,
              },
              update: {
                name: tag,
              },
              where: {
                name_userId: {
                  name: tag,
                  userId,
                },
              },
            })
          }),
        )

        // Finally, link the tags to bookmark in intermediate join table
        await Promise.all(
          upsertTagRes.map((tag) => {
            return prisma.tagsOnBookmarks.upsert({
              create: {
                bookmarkId: upsertBookmarkRes.id,
                tagId: tag.id,
              },
              update: {
                bookmarkId: upsertBookmarkRes.id,
                tagId: tag.id,
              },
              where: {
                bookmarkId_tagId: {
                  bookmarkId: upsertBookmarkRes.id,
                  tagId: tag.id,
                },
              },
            })
          }),
        )
      }

      return {
        form,
        bookmark: upsertBookmarkRes,
        message: "Added Successfully",
        type: "success",
      };
    } catch (error) {
      console.error(error)
      fail(500, { type: "error", message: 'Failed to add bookmark' })
    }
  }
}

export const load: PageServerLoad = async ({ parent, locals, url }) => {
  await parent()
  try {
    const skip = Number(url.searchParams.get('skip') ?? "0")
    const limit = Number(url.searchParams.get('limit') ?? "10")

    const session = await locals.getSession();
    if (!session?.user?.userId) {
      return fail(401, { type: "error", error: "Unauthenticated" })
    }

    const [categories, tags] = await prisma.$transaction([
      prisma.category.findMany({
        where: { userId: session.user.userId },
      }),
      prisma.tag.findMany({
        where: { userId: session.user.userId },
      })
    ])

    const [data, count] = await prisma.bookmark.findManyAndCount({
      take: limit + skip,
      skip: skip,
      where: { userId: session?.user?.userId },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return {
      bookmarks: data,
      count,
      categories,
      tags,
    };
  } catch (error) {
    let message
    if (typeof error === "string") {
      message = error.toUpperCase()
    } else if (error instanceof Error) {
      message = error.message
    }
    return { bookmarks: [], categories: [], tags: [], count: 1, error: message }
  }
};
