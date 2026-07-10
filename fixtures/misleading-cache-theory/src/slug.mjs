export function toSlug(input) {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}
