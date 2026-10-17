import "server-only";

import { z } from "zod";

import { getPublicSupabaseEnv } from "@/lib/env";

const dataApiDescriptionSchema = z
  .object({
    openapi: z.string().min(1).optional(),
    paths: z.record(z.string(), z.unknown()),
    swagger: z.string().min(1).optional(),
  })
  .refine((description) => description.openapi ?? description.swagger, {
    message: "The Data API description must declare an OpenAPI or Swagger version.",
  });

export async function queryDatabaseApi() {
  const env = getPublicSupabaseEnv();
  const endpoint = new URL("/rest/v1/", env.NEXT_PUBLIC_SUPABASE_URL);
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: {
      accept: "application/openapi+json",
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase Data API health query failed with status ${response.status}.`);
  }

  const description = dataApiDescriptionSchema.parse(await response.json());
  const descriptionVersion = description.openapi ?? description.swagger;

  if (!descriptionVersion) {
    throw new Error("The validated Data API description is missing its version.");
  }

  return {
    exposedPathCount: Object.keys(description.paths).length,
    openApiVersion: descriptionVersion,
  };
}
