import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAllOrThrow } from "convex-helpers/server/relationships";
export const get = query({
  args: {
    orgId: v.string(),
    search: v.optional(v.string()),

    favorites: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.favorites) {
      const favoriteDraws = await ctx.db
        .query("userFavorites")
        .withIndex("by_user_org", (q) =>
          q.eq("userId", identity.subject).eq("orgId", args.orgId)
        )
        .order("desc")
        .collect();
      const ids = favoriteDraws.map((fav) => fav.drawId);

      const draws = await getAllOrThrow(ctx.db, ids);

      const title = args.search as string;
      const filteredDraws = title
        ? draws.filter((draw) =>
            draw.title.toLowerCase().includes(title.toLowerCase())
          )
        : draws;

      return filteredDraws.map((draw) => ({ ...draw, isFavorite: true }));
    }

    const title = args.search as string;
    let draws = [];

    if (title) {
      draws = await ctx.db
        .query("draw")
        .withSearchIndex("search_title", (q) =>
          q.search("title", title).eq("orgId", args.orgId)
        )
        .collect();
    } else {
      draws = await ctx.db
        .query("draw")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .order("desc")
        .collect();
    }

    const drawsWithFavoriteRelateion = draws.map((draw) => {
      return ctx.db
        .query("userFavorites")
        .withIndex("by_user_draw", (q) =>
          q.eq("userId", identity.subject).eq("drawId", draw._id)
        )
        .unique()
        .then((favorite) => {
          return {
            ...draw,
            isFavorite: !!favorite,
          };
        });
    });

    const drawsWithFavoriteBoolean = Promise.all(drawsWithFavoriteRelateion);
    return drawsWithFavoriteBoolean;
  },
});
