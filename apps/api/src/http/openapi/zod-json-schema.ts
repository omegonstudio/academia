import { z } from 'zod';

/** Convert a Zod schema to an OpenAPI 3.0-compatible JSON Schema object. */
export function zodToOpenApiSchema(
  schema: z.ZodType,
): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'openapi-3.0' }) as Record<
    string,
    unknown
  >;
}
