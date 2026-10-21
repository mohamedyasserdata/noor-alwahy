import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export type ContactLink = {
  createdAt: string;
  id: string;
  isVisible: boolean;
  labelAr: string;
  labelEn: string | null;
  sortOrder: number;
  type: string;
  url: string;
};

export async function getContactLinks(): Promise<ContactLink[]> {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_links")
    .select("id,type,label_ar,label_en,url,sort_order,is_visible,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("contact_links_unavailable", { cause: error });
  }

  return (data ?? []).map((link) => ({
    createdAt: link.created_at,
    id: link.id,
    isVisible: link.is_visible,
    labelAr: link.label_ar,
    labelEn: link.label_en,
    sortOrder: link.sort_order,
    type: link.type,
    url: link.url,
  }));
}

export async function getPublicContactLinks(): Promise<ContactLink[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("public-contact-links");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("contact_links")
    .select("id,type,label_ar,label_en,url,sort_order,is_visible,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("public_contact_links_unavailable", { cause: error });
  }

  return (data ?? []).map((link) => ({
    createdAt: link.created_at,
    id: link.id,
    isVisible: link.is_visible,
    labelAr: link.label_ar,
    labelEn: link.label_en,
    sortOrder: link.sort_order,
    type: link.type,
    url: link.url,
  }));
}
