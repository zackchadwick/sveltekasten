<script lang="ts">
  import { page } from "$app/stores"
  import { ofetch } from "ofetch"
  import { format } from "@formkit/tempo"
  import { Badge } from "$lib/components/ui/badge"
  import { useInterface } from "$state/ui.svelte"
  import { invalidateAll } from "$app/navigation"
  import { Image } from "$lib/components/image"
  import BookmarkActions from "./BookmarkActions.svelte"

  const ui = useInterface()

  const { bookmark = $bindable() }: { bookmark: LoadBookmarkFlatTags } = $props()

  let isDeleteDialogOpen = $state(false)
  let isOptionsOpen = $state(false)

  const handleDeleteDialogOpen = () => {
    isDeleteDialogOpen = true
  }
  const handleMetadataSidebarOpen = () => {
    ui.setMetadataSidebarData({
      bookmark,
      categories: $page.data.categories,
      tags: $page.data.tags,
    })
    ui.toggleMetadataSidebar(true)
    ui.toggleMetadataSidebarEditMode(false)
  }
  const openButtonGroup = () => {
    isOptionsOpen = true
  }
  const closeButtonGroup = () => {
    isOptionsOpen = false
  }
  const handleArchive = async () => {
    await ofetch(`/api/v1/bookmarks`, {
      method: "PUT",
      body: { id: bookmark.id, update: { archived: true } },
    })
    invalidateAll()
  }
</script>

<div
  tabindex={0}
  data-id={bookmark.id}
  role="row"
  class="grid relative gap-4 p-4 mx-4 rounded-lg rounded-l-none border-l-4 border-transparent transition-all duration-300 outline-none focus:outline-none grid-cols-[15rem_1fr] dark:focus:bg-zinc-900 focus:border-zinc-500 focus:bg-zinc-100"
  on:mouseleave={closeButtonGroup}
  on:mouseenter={openButtonGroup}
>
  {#await import("./DeleteDialog.svelte") then { default: DeleteDialog }}
    <svelte:component this={DeleteDialog} bind:open={isDeleteDialogOpen} bookmarkId={bookmark.id} />
  {/await}
  <Image
    thumbhash={bookmark.imageBlur ?? ""}
    src={bookmark.image ?? `https://source.unsplash.com/random/240x144?sig=${bookmark.url}`}
    alt={`${new URL(bookmark.url).hostname} Screenshot`}
    class="w-60 h-36 rounded-md border transition border-neutral-100 dark:border-neutral-800"
  />
  <div class="flex flex-col gap-2">
    <span class="text-xl font-semibold line-clamp-1 text-clip" title={bookmark.title}>
      {bookmark.title}
    </span>
    <p class="break-words line-clamp-2">{bookmark.desc}</p>
    <div class="flex gap-2 justify-start items-center text-sm text-muted">
      {#if bookmark.metadata?.logo}
        <img src={bookmark.metadata?.logo} alt="URL Favicon" class="rounded-full size-4" />
      {/if}
      <a target="_blank" href={bookmark.url} class="line-clamp-1 text-clip text-zinc-500">
        {bookmark.url}
      </a>
    </div>
    <span class="flex flex-wrap gap-2">
      <Badge variant="default">
        {format(bookmark.createdAt, { date: "medium", time: "short" })}
      </Badge>
      {#if bookmark.category?.name}
        <Badge variant="secondary">
          {bookmark.category.name}
        </Badge>
      {/if}
      {#if bookmark.tags?.length}
        <span class="flex flex-wrap gap-2">
          {#each bookmark.tags as tag}
            <Badge variant="outline">
              {tag.name}
            </Badge>
          {/each}
        </span>
      {/if}
    </span>
  </div>
  <BookmarkActions
    url={bookmark.url ?? ""}
    {handleMetadataSidebarOpen}
    {handleDeleteDialogOpen}
    {isOptionsOpen}
    {handleArchive}
  />
</div>
