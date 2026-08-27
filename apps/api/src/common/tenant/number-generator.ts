import { Model } from 'mongoose';

/**
 * Generates a tenant-prefixed sequential number.
 * The prefix is derived from the tenant slug (first 3 chars, uppercased).
 * Examples: acme -> ACM-000001, demo -> DEM-000001
 */
export function tenantPrefix(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
}

/**
 * Finds the next sequential number for a tenant-scoped collection.
 * Scans existing documents matching the prefix pattern and increments.
 */
export async function nextSequentialNumber<T extends { tenantId: string }>(
  model: Model<T>,
  ctx: { tenantId: string; tenantSlug: string },
  field: keyof T & string,
  type: string
): Promise<string> {
  const prefix = tenantPrefix(ctx.tenantSlug);
  const pattern = new RegExp(`^${prefix}-${type}-\\d+$`);
  const docs = await model
    .find({ tenantId: ctx.tenantId, [field]: pattern })
    .select({ [field]: 1 })
    .lean();

  const next = docs.reduce((max, doc) => {
    const value = String(doc[field] ?? '');
    const match = value.match(new RegExp(`^${prefix}-${type}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;

  return `${prefix}-${type}-${String(next).padStart(4, '0')}`;
}
