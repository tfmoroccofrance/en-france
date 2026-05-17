import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SITE } from "@/config";

export const BLOG_PATH = "src/data/blog";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      category: z.string().default("Recettes Françaises"),
      categories: z.array(z.string()).optional(),
      ogImage: image().or(z.string()).optional(),
      featuredImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
      prepTime: z.string().optional(),
      cookTime: z.string().optional(),
      totalTime: z.string().optional(),
      recipeYield: z.string().optional(),
      cuisine: z.string().default("Française"),
      ingredients: z.array(z.string()).optional(),
      instructions: z.array(z.string()).optional(),
      nutrition: z
        .object({
          calories: z.string().optional(),
          proteinContent: z.string().optional(),
          carbohydrateContent: z.string().optional(),
          fatContent: z.string().optional(),
        })
        .optional(),
      faq: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .optional(),
    }),
});

export const collections = { blog };
