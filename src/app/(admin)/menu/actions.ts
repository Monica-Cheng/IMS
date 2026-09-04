"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Discriminated result returned by every product action so the UI can render
// inline success/error feedback instead of relying on redirects with ?error=.
export type ProductActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

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

// For optional numeric fields: a blank input means "no value" (NULL), not 0.
function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

export async function createProduct(
  _prev: ProductActionResult | null,
  formData: FormData
): Promise<ProductActionResult> {
  const { supabase, user } = await requireAdminUser();
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const descriptionValue = String(formData.get("description") ?? "").trim();
  const price = parseNumber(formData.get("price"));
  const costPrice = parseOptionalNumber(formData.get("costPrice"));
  const stock = parseNumber(formData.get("stock"));
  const imageUrlValue = String(formData.get("imageUrl") ?? "").trim();

  if (!name || !categoryId) {
    return { ok: false, message: "Product name and category are required." };
  }

  if (price < 0) {
    return { ok: false, message: "Price cannot be negative." };
  }

  if (costPrice !== null && costPrice < 0) {
    return { ok: false, message: "Cost price cannot be negative." };
  }

  if (stock < 0) {
    return { ok: false, message: "Starting stock cannot be negative." };
  }

  if (!(await ensureCategoryBelongsToAdmin(categoryId, user.id))) {
    return { ok: false, message: "Choose a valid category for your business." };
  }

  const { error } = await supabase.from("products").insert({
    admin_id: user.id,
    category_id: categoryId,
    name,
    description: descriptionValue || null,
    price,
    cost_price: costPrice,
    stock,
    image_url: imageUrlValue || null,
  });

  if (error) {
    return { ok: false, message: "Failed to create product." };
  }

  revalidatePath("/menu");
  revalidatePath("/menu/categories");
  revalidatePath("/menu/products");
  return { ok: true, message: `"${name}" added.` };
}

export async function updateProduct(
  _prev: ProductActionResult | null,
  formData: FormData
): Promise<ProductActionResult> {
  const { supabase, user } = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const descriptionValue = String(formData.get("description") ?? "").trim();
  const price = parseNumber(formData.get("price"));
  const costPrice = parseOptionalNumber(formData.get("costPrice"));
  const imageUrlValue = String(formData.get("imageUrl") ?? "").trim();

  if (!id || !name || !categoryId) {
    return { ok: false, message: "Product update is missing required data." };
  }

  if (price < 0) {
    return { ok: false, message: "Price cannot be negative." };
  }

  if (costPrice !== null && costPrice < 0) {
    return { ok: false, message: "Cost price cannot be negative." };
  }

  if (!(await ensureCategoryBelongsToAdmin(categoryId, user.id))) {
    return { ok: false, message: "Choose a valid category for your business." };
  }

  // Stock is intentionally NOT written here. It changes only through
  // adjustProductStock and through order completion (the complete_order RPC),
  // so a slow edit form can never overwrite a concurrent sale or adjustment.
  // A blank cost price clears the stored value (back to NULL).
  const { error } = await supabase
    .from("products")
    .update({
      category_id: categoryId,
      name,
      description: descriptionValue || null,
      price,
      cost_price: costPrice,
      image_url: imageUrlValue || null,
    })
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to update product." };
  }

  revalidatePath("/menu");
  revalidatePath("/menu/products");
  return { ok: true, message: "Product details saved." };
}

export async function adjustProductStock(
  _prev: ProductActionResult | null,
  formData: FormData
): Promise<ProductActionResult> {
  const { supabase, user } = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const delta = parseNumber(formData.get("delta"));

  if (!id) {
    return { ok: false, message: "Stock adjustment is missing required data." };
  }

  if (!Number.isInteger(delta) || delta === 0) {
    return {
      ok: false,
      message: "Enter a non-zero whole number to adjust stock by.",
    };
  }

  const { data: product } = await supabase
    .from("products")
    .select("stock")
    .eq("id", id)
    .eq("admin_id", user.id)
    .maybeSingle();

  if (!product) {
    return { ok: false, message: "Product not found." };
  }

  const nextStock = product.stock + delta;

  if (nextStock < 0) {
    return {
      ok: false,
      message: `Cannot reduce by ${Math.abs(delta)} — only ${product.stock} in stock.`,
    };
  }

  const { error } = await supabase
    .from("products")
    .update({ stock: nextStock })
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to adjust stock." };
  }

  revalidatePath("/menu");
  revalidatePath("/menu/products");
  return {
    ok: true,
    message: `Stock ${delta > 0 ? "increased" : "decreased"} to ${nextStock}.`,
  };
}

export async function toggleProductAvailability(
  _prev: ProductActionResult | null,
  formData: FormData
): Promise<ProductActionResult> {
  const { supabase, user } = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const nextValue = String(formData.get("nextValue") ?? "") === "true";

  if (!id) {
    return { ok: false, message: "Availability change is missing required data." };
  }

  const { error } = await supabase
    .from("products")
    .update({ is_available: nextValue })
    .eq("id", id)
    .eq("admin_id", user.id);

  if (error) {
    return { ok: false, message: "Failed to update product availability." };
  }

  revalidatePath("/menu");
  revalidatePath("/menu/products");
  return {
    ok: true,
    message: nextValue
      ? "Product is now available in the POS."
      : "Product is now hidden from the POS.",
  };
}
