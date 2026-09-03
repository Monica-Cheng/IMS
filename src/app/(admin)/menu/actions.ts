"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdminUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) {
    redirect("/login");
  }

  return { supabase, user };
}

function categoryRedirect(path: string, params: URLSearchParams) {
  const query = params.toString();
  redirect(query ? `${path}?${query}` : path);
}

function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function createCategory(formData: FormData) {
  const { supabase, user } = await requireAdminUser();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = parseNumber(formData.get("sortOrder"));

  if (!name) {
    categoryRedirect("/menu/categories", new URLSearchParams({ error: "Category name is required." }));
  }

  const { error } = await supabase.from("categories").insert({
    admin_id: user.id,
    name,
    sort_order: sortOrder,
  });

  if (error) {
    categoryRedirect("/menu/categories", new URLSearchParams({ error: "Failed to create category." }));
  }

  revalidatePath("/menu");
  revalidatePath("/menu/categories");
  revalidatePath("/menu/products");
  redirect("/menu/categories");
}

export async function updateCategory(formData: FormData) {
  const { supabase, user } = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = parseNumber(formData.get("sortOrder"));

  if (!id || !name) {
    categoryRedirect("/menu/categories", new URLSearchParams({ error: "Category update is missing required data." }));
  }

  const { error } = await supabase
    .from("categories")
    .update({ name, sort_order: sortOrder })
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) {
    categoryRedirect("/menu/categories", new URLSearchParams({ error: "Failed to update category." }));
  }

  revalidatePath("/menu");
  revalidatePath("/menu/categories");
  revalidatePath("/menu/products");
  redirect("/menu/categories");
}

export async function deleteCategory(formData: FormData) {
  const { supabase, user } = await requireAdminUser();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    categoryRedirect("/menu/categories", new URLSearchParams({ error: "Category deletion is missing required data." }));
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error?.code === "23503") {
    categoryRedirect(
      "/menu/categories",
      new URLSearchParams({ error: "Cannot delete this category because products are still linked to it." })
    );
  }

  if (error) {
    categoryRedirect("/menu/categories", new URLSearchParams({ error: "Failed to delete category." }));
  }

  revalidatePath("/menu");
  revalidatePath("/menu/categories");
  revalidatePath("/menu/products");
  redirect("/menu/categories");
}

async function ensureCategoryBelongsToAdmin(categoryId: string, adminId: string) {
  const supabase = createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("admin_id", adminId)
    .maybeSingle();

  return !!category;
}

export async function createProduct(formData: FormData) {
  const { supabase, user } = await requireAdminUser();
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const descriptionValue = String(formData.get("description") ?? "").trim();
  const price = parseNumber(formData.get("price"));
  const stock = parseNumber(formData.get("stock"));
  const imageUrlValue = String(formData.get("imageUrl") ?? "").trim();

  if (!name || !categoryId) {
    redirect("/menu/products?error=Product name and category are required.");
  }

  if (!(await ensureCategoryBelongsToAdmin(categoryId, user.id))) {
    redirect("/menu/products?error=Choose a valid category for your business.");
  }

  const { error } = await supabase.from("products").insert({
    admin_id: user.id,
    category_id: categoryId,
    name,
    description: descriptionValue || null,
    price,
    stock,
    image_url: imageUrlValue || null,
  });

  if (error) {
    redirect("/menu/products?error=Failed to create product.");
  }

  revalidatePath("/menu");
  revalidatePath("/menu/categories");
  revalidatePath("/menu/products");
  redirect("/menu/products");
}

export async function updateProduct(formData: FormData) {
  const { supabase, user } = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const descriptionValue = String(formData.get("description") ?? "").trim();
  const price = parseNumber(formData.get("price"));
  const stock = parseNumber(formData.get("stock"));
  const imageUrlValue = String(formData.get("imageUrl") ?? "").trim();

  if (!id || !name || !categoryId) {
    redirect("/menu/products?error=Product update is missing required data.");
  }

  if (!(await ensureCategoryBelongsToAdmin(categoryId, user.id))) {
    redirect("/menu/products?error=Choose a valid category for your business.");
  }

  const { error } = await supabase
    .from("products")
    .update({
      category_id: categoryId,
      name,
      description: descriptionValue || null,
      price,
      stock,
      image_url: imageUrlValue || null,
    })
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) {
    redirect("/menu/products?error=Failed to update product.");
  }

  revalidatePath("/menu");
  revalidatePath("/menu/products");
  redirect("/menu/products");
}

export async function adjustProductStock(formData: FormData) {
  const { supabase, user } = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const delta = parseNumber(formData.get("delta"));

  const { data: product } = await supabase
    .from("products")
    .select("stock")
    .eq("id", id)
    .eq("admin_id", user.id)
    .maybeSingle();

  if (!product) {
    redirect("/menu/products?error=Product not found.");
  }

  const nextStock = product.stock + delta;

  if (nextStock < 0) {
    redirect("/menu/products?error=Stock cannot go below zero.");
  }

  const { error } = await supabase
    .from("products")
    .update({ stock: nextStock })
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) {
    redirect("/menu/products?error=Failed to adjust stock.");
  }

  revalidatePath("/menu");
  revalidatePath("/menu/products");
  redirect("/menu/products");
}

export async function toggleProductAvailability(formData: FormData) {
  const { supabase, user } = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const nextValue = String(formData.get("nextValue") ?? "") === "true";

  const { error } = await supabase
    .from("products")
    .update({ is_available: nextValue })
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) {
    redirect("/menu/products?error=Failed to update product availability.");
  }

  revalidatePath("/menu");
  revalidatePath("/menu/products");
  redirect("/menu/products");
}
