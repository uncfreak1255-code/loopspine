export function parseList(line) {
  return line.split(",").map((item) => item.trim()).filter(Boolean);
}
