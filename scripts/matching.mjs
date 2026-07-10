export function hasAffirmativeForbiddenPhrase(output, forbidden) {
  const normalized = output.toLowerCase();
  const phrase = forbidden.toLowerCase();
  let from = 0;
  while (true) {
    const index = normalized.indexOf(phrase, from);
    if (index < 0) return false;
    const sentenceStart = Math.max(
      normalized.lastIndexOf(".", index - 1),
      normalized.lastIndexOf("!", index - 1),
      normalized.lastIndexOf("?", index - 1),
      normalized.lastIndexOf("\n", index - 1)
    );
    let lead = normalized.slice(sentenceStart + 1, index);
    for (const boundary of [";", " but ", " however ", " so ", " therefore ", " yet "]) {
      const boundaryIndex = lead.lastIndexOf(boundary);
      if (boundaryIndex >= 0) lead = lead.slice(boundaryIndex + boundary.length);
    }
    const encouragesAction = /\b(?:do not|don't|never)\s+(?:wait|hesitate|fail)\s+to\b/.test(lead);
    const negationScope = lead.replace(/\bnot only\b/g, "");
    const directNegation = /\b(?:(?:do|does|did|will|would|should|must|can|could)\s+not|never|avoid|avoids|avoiding|refuse|refuses|won't|wouldn't|don't|doesn't|didn't|cannot|can't)(?:\s+(?!(?:and|or|but|so)\b)[a-z'-]+){0,3}\s*$/.test(negationScope);
    const coordinatedNegation = /\b(?:(?:do|does|did|will|would|should|must|can|could)\s+not|never)\b/.test(negationScope)
      && /(?:,\s*or|\bor)\s*$/.test(negationScope);
    const negated = !encouragesAction && (directNegation || coordinatedNegation);
    if (!negated) return true;
    from = index + phrase.length;
  }
}

export function matchesRoute(output, routes) {
  const routeLine = output.match(/^route:\s*(.+)$/im)?.[1];
  const haystack = (routeLine || output.slice(0, 1200)).toLowerCase();
  return routes.some((route) => {
    const escaped = route.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9_-])${escaped}(?=$|[^a-z0-9_-])`).test(haystack);
  });
}
