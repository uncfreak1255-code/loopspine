import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalPath(filePath, label) {
  try {
    return fs.realpathSync(filePath);
  } catch (error) {
    throw new Error(`${label} does not resolve: ${error.message}`);
  }
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

export function parseClaudeStream(rawOutput) {
  const lines = String(rawOutput).split(/\r?\n/);
  const events = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      const event = JSON.parse(line);
      if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("event is not an object");
      events.push({ event, line: index + 1 });
    } catch (error) {
      throw new Error(`malformed Claude stream event on line ${index + 1}: ${error.message}`);
    }
  }
  if (!events.length) throw new Error("Claude stream contains no events");
  return events;
}

export function verifyLoopSpineReceipt({ text, expectedLane, expectedProofTerms = [] }) {
  const requiredFields = ["LANE", "RESULT", "PROOF", "BOUNDARY", "RESIDUE"];
  let lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let trailingContext = "";
  if (/^```/.test(lines[0] || "")) {
    const closingFence = lines.indexOf("```", 1);
    if (closingFence < 0) throw new Error("LoopSpine receipt has an unclosed code fence");
    trailingContext = lines.slice(closingFence + 1).join(" ").trim();
    lines = lines.slice(1, closingFence);
  } else if (lines.length > requiredFields.length) {
    trailingContext = lines.slice(requiredFields.length).join(" ").trim();
    lines = lines.slice(0, requiredFields.length);
  }
  if (lines.length !== requiredFields.length) {
    throw new Error("LoopSpine receipt must contain exactly five field lines");
  }
  if (trailingContext.length > 500 || /\b(?:cannot|can't|unable|failed|refus(?:e|ed|al)|error)\b/i.test(trailingContext)) {
    throw new Error("LoopSpine receipt has invalid trailing context");
  }
  const fields = {};
  for (let index = 0; index < requiredFields.length; index += 1) {
    const field = requiredFields[index];
    const match = lines[index].match(new RegExp(`^${field}:\\s*(\\S.*)$`));
    if (!match) throw new Error(`LoopSpine receipt is missing ordered ${field}`);
    fields[field] = match[1].trim();
  }
  if (expectedLane && fields.LANE !== expectedLane) {
    throw new Error(`LoopSpine receipt lane must be ${expectedLane}`);
  }
  if (!/^(?:success|clean-no-op)$/.test(fields.RESULT)) {
    throw new Error("LoopSpine receipt result is not successful");
  }
  for (const term of expectedProofTerms) {
    if (!fields.PROOF.includes(term)) throw new Error(`LoopSpine receipt proof is missing ${term}`);
  }
  return { ...fields, trailing_context: trailingContext || null };
}

export function verifyClaudeIsolation({ rawOutput, pluginRoot }) {
  const canonicalRoot = canonicalPath(pluginRoot, "plugin root");
  const events = parseClaudeStream(rawOutput).map(({ event }) => event);
  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  if (!init) throw new Error("Claude stream is missing the init event");
  if (!Array.isArray(init.plugins) || init.plugins.length !== 1) {
    throw new Error("Claude init event must contain only the LoopSpine plugin");
  }
  const [plugin] = init.plugins;
  if (plugin?.name !== "loopspine" || typeof plugin.path !== "string"
    || canonicalPath(plugin.path, "loaded plugin path") !== canonicalRoot) {
    throw new Error("Claude init event does not contain the expected isolated LoopSpine plugin");
  }
  const hookEvents = events.filter((event) => event.type === "system" && /^hook_/.test(event.subtype || ""));
  if (hookEvents.length) throw new Error("Claude stream contains hook events during the isolated smoke");
  return {
    plugin_name: plugin.name,
    plugin_root: canonicalRoot,
    loaded_plugin_count: 1,
    hook_event_count: 0
  };
}

function verifyClaudeSession(events, canonicalRoot) {
  const sessionIds = new Set(events.map((event) => event.session_id).filter((value) => typeof value === "string" && value));
  if (sessionIds.size !== 1) throw new Error("Claude stream must contain exactly one session id");
  const [sessionId] = sessionIds;

  const initIndex = events.findIndex((event) => event.type === "system" && event.subtype === "init");
  if (initIndex < 0) throw new Error("Claude stream is missing the init event");
  const init = events[initIndex];
  if (!Array.isArray(init.tools) || init.tools.length !== 1 || init.tools[0] !== "Read") {
    throw new Error("Claude init event is not restricted to the Read tool");
  }
  if (init.permissionMode !== "plan") throw new Error("Claude init event is not in plan permission mode");
  if (!Array.isArray(init.mcp_servers) || init.mcp_servers.length !== 0) {
    throw new Error("Claude init event exposes MCP servers during the read-only probe");
  }
  const pluginLoaded = Array.isArray(init.plugins) && init.plugins.some((plugin) => {
    if (plugin?.name !== "loopspine" || typeof plugin.path !== "string") return false;
    try {
      return canonicalPath(plugin.path, "loaded plugin path") === canonicalRoot;
    } catch {
      return false;
    }
  });
  if (!pluginLoaded) throw new Error("Claude init event does not identify the expected LoopSpine plugin root");

  const resultIndex = events.findIndex((event) => event.type === "result");
  if (resultIndex < 0) throw new Error("Claude stream is missing the terminal result event");
  if (initIndex >= resultIndex) throw new Error("Claude init event must occur before the terminal result");
  const result = events[resultIndex];
  if (result.subtype !== "success" || result.is_error) throw new Error("Claude terminal result is not successful");
  return { init, initIndex, resultIndex, sessionId };
}

export function verifyClaudeNoReadEvent({ rawOutput, pluginRoot, referencePath }) {
  const canonicalRoot = canonicalPath(pluginRoot, "plugin root");
  const canonicalReference = canonicalPath(referencePath, "reference file");
  if (!isInside(canonicalRoot, canonicalReference) || canonicalReference === canonicalRoot) {
    throw new Error("reference file must resolve inside the plugin root");
  }
  const events = parseClaudeStream(rawOutput).map(({ event }) => event);
  const session = verifyClaudeSession(events, canonicalRoot);
  let referenceReadEvents = 0;
  for (let eventIndex = 0; eventIndex < session.resultIndex; eventIndex += 1) {
    const blocks = Array.isArray(events[eventIndex].message?.content) ? events[eventIndex].message.content : [];
    for (const block of blocks) {
      if (block?.type !== "tool_use" || block.name !== "Read" || typeof block.input?.file_path !== "string") continue;
      try {
        if (canonicalPath(block.input.file_path, "Read tool path") === canonicalReference) referenceReadEvents += 1;
      } catch {
        // An unrelated failed path is not evidence that the reference was read.
      }
    }
  }
  if (referenceReadEvents) throw new Error("Claude stream contains an unexpected Read tool_use event for the reference file");
  return {
    session_id: session.sessionId,
    plugin_root: canonicalRoot,
    reference_path: canonicalReference,
    reference_read_events: 0,
    init_event_index: session.initIndex,
    result_event_index: session.resultIndex,
    available_tools: session.init.tools,
    mcp_servers: session.init.mcp_servers,
    permission_mode: session.init.permissionMode,
    claude_code_version: session.init.claude_code_version || null,
    model: session.init.model || null
  };
}

export function verifyClaudeReadEvent({ rawOutput, pluginRoot, referencePath, referenceSha256 }) {
  const canonicalRoot = canonicalPath(pluginRoot, "plugin root");
  const canonicalReference = canonicalPath(referencePath, "reference file");
  if (!isInside(canonicalRoot, canonicalReference) || canonicalReference === canonicalRoot) {
    throw new Error("reference file must resolve inside the plugin root");
  }

  const actualReferenceContent = fs.readFileSync(canonicalReference);
  const actualReferenceSha256 = sha256(actualReferenceContent);
  if (actualReferenceSha256 !== referenceSha256) {
    throw new Error("reference file hash does not match the expected hash");
  }

  const parsed = parseClaudeStream(rawOutput);
  const events = parsed.map(({ event }) => event);
  const session = verifyClaudeSession(events, canonicalRoot);
  const { init, initIndex, resultIndex, sessionId } = session;

  let matchedToolUse = null;
  for (let eventIndex = initIndex + 1; eventIndex < resultIndex; eventIndex += 1) {
    const event = events[eventIndex];
    if (event.type !== "assistant" || !Array.isArray(event.message?.content)) continue;
    for (const block of event.message.content) {
      if (block?.type !== "tool_use" || block.name !== "Read" || typeof block.id !== "string" || typeof block.input?.file_path !== "string") continue;
      let toolPath;
      try {
        toolPath = canonicalPath(block.input.file_path, "Read tool path");
      } catch {
        continue;
      }
      if (toolPath === canonicalReference) {
        matchedToolUse = { eventIndex, id: block.id };
        break;
      }
    }
    if (matchedToolUse) break;
  }
  if (!matchedToolUse) throw new Error("Claude stream has no matching Read tool_use event before the terminal result");

  let matchedToolResult = null;
  for (let eventIndex = matchedToolUse.eventIndex + 1; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    const blocks = Array.isArray(event.message?.content) ? event.message.content : [];
    const correlated = blocks.some((block) => block?.type === "tool_result" && block.tool_use_id === matchedToolUse.id);
    if (!correlated) continue;
    if (eventIndex >= resultIndex) throw new Error("correlated tool_result must occur before the terminal result");

    const file = event.tool_use_result?.file;
    if (!file || typeof file.filePath !== "string" || typeof file.content !== "string") {
      throw new Error("correlated tool_result is missing structured file evidence");
    }
    const resultPath = canonicalPath(file.filePath, "tool result file path");
    if (resultPath !== canonicalReference) throw new Error("correlated tool_result names the wrong file");
    if (sha256(file.content) !== referenceSha256) throw new Error("correlated tool_result content hash does not match the reference");
    matchedToolResult = { eventIndex };
    break;
  }
  if (!matchedToolResult) throw new Error("Claude stream has no correlated tool_result for the matching Read event");

  return {
    session_id: sessionId,
    plugin_root: canonicalRoot,
    reference_path: canonicalReference,
    reference_sha256: referenceSha256,
    init_event_index: initIndex,
    tool_use_event_index: matchedToolUse.eventIndex,
    tool_result_event_index: matchedToolResult.eventIndex,
    result_event_index: resultIndex,
    tool_use_id: matchedToolUse.id,
    available_tools: init.tools,
    mcp_servers: init.mcp_servers,
    permission_mode: init.permissionMode,
    claude_code_version: init.claude_code_version || null,
    model: init.model || null
  };
}
