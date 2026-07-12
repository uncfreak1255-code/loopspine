import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyClaudeNoReadEvent, verifyClaudeReadEvent } from "./claude-access-events.mjs";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "loopspine-access-events-"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function eventStream({
  pluginRoot,
  referencePath,
  referenceContent,
  includeToolUse = true,
  includeToolResult = true,
  resultBeforeToolResult = false,
  toolPath = referencePath,
  resultPath = referencePath,
  resultContent = referenceContent
}) {
  const sessionId = "probe-session";
  const toolUse = {
    type: "assistant",
    session_id: sessionId,
    message: {
      content: [{
        type: "tool_use",
        id: "tool-read-1",
        name: "Read",
        input: { file_path: toolPath }
      }]
    }
  };
  const toolResult = {
    type: "user",
    session_id: sessionId,
    message: {
      content: [{
        type: "tool_result",
        tool_use_id: "tool-read-1",
        content: resultContent
      }]
    },
    tool_use_result: {
      type: "text",
      file: { filePath: resultPath, content: resultContent }
    }
  };
  const result = {
    type: "result",
    subtype: "success",
    is_error: false,
    session_id: sessionId,
    result: "I read the reference."
  };
  const events = [{
    type: "system",
    subtype: "init",
    session_id: sessionId,
    tools: ["Read"],
    mcp_servers: [],
    permissionMode: "plan",
    plugins: [{ name: "loopspine", path: pluginRoot, source: "loopspine@inline" }]
  }];
  if (includeToolUse) events.push(toolUse);
  if (resultBeforeToolResult) events.push(result);
  if (includeToolResult) events.push(toolResult);
  if (!resultBeforeToolResult) events.push(result);
  return events.map((event) => JSON.stringify(event)).join("\n");
}

try {
  const pluginRoot = path.join(tempRoot, "plugin");
  const referencePath = path.join(pluginRoot, "references", "probe.md");
  const referenceContent = "# Probe reference\n";
  fs.mkdirSync(path.dirname(referencePath), { recursive: true });
  fs.writeFileSync(referencePath, referenceContent);

  const verified = verifyClaudeReadEvent({
    rawOutput: eventStream({ pluginRoot, referencePath, referenceContent }),
    pluginRoot,
    referencePath,
    referenceSha256: sha256(referenceContent)
  });
  assert.equal(verified.session_id, "probe-session");
  assert.equal(verified.tool_use_id, "tool-read-1");
  assert.equal(verified.reference_sha256, sha256(referenceContent));
  assert.ok(verified.tool_use_event_index < verified.tool_result_event_index);
  assert.ok(verified.tool_result_event_index < verified.result_event_index);

  const reorderedEvents = eventStream({ pluginRoot, referencePath, referenceContent })
    .split("\n")
    .map((line) => JSON.parse(line));
  const reorderedStream = [reorderedEvents[1], reorderedEvents[2], reorderedEvents[0], reorderedEvents[3]]
    .map((event) => JSON.stringify(event))
    .join("\n");
  assert.throws(
    () => verifyClaudeReadEvent({
      rawOutput: reorderedStream,
      pluginRoot,
      referencePath,
      referenceSha256: sha256(referenceContent)
    }),
    /matching Read tool_use event/
  );

  assert.throws(
    () => verifyClaudeReadEvent({
      rawOutput: eventStream({
        pluginRoot,
        referencePath,
        referenceContent,
        includeToolUse: false,
        includeToolResult: false
      }),
      pluginRoot,
      referencePath,
      referenceSha256: sha256(referenceContent)
    }),
    /matching Read tool_use event/
  );

  assert.throws(
    () => verifyClaudeReadEvent({
      rawOutput: eventStream({
        pluginRoot,
        referencePath,
        referenceContent,
        includeToolResult: false
      }),
      pluginRoot,
      referencePath,
      referenceSha256: sha256(referenceContent)
    }),
    /correlated tool_result/
  );

  assert.throws(
    () => verifyClaudeReadEvent({
      rawOutput: eventStream({
        pluginRoot,
        referencePath,
        referenceContent,
        resultBeforeToolResult: true
      }),
      pluginRoot,
      referencePath,
      referenceSha256: sha256(referenceContent)
    }),
    /before the terminal result/
  );

  const otherPath = path.join(pluginRoot, "references", "other.md");
  fs.writeFileSync(otherPath, "# Other\n");
  const noRead = verifyClaudeNoReadEvent({
    rawOutput: eventStream({
      pluginRoot,
      referencePath,
      referenceContent,
      toolPath: otherPath,
      resultPath: otherPath,
      resultContent: "# Other\n"
    }),
    pluginRoot,
    referencePath
  });
  assert.equal(noRead.reference_read_events, 0);
  assert.equal(noRead.session_id, "probe-session");

  assert.throws(
    () => verifyClaudeNoReadEvent({
      rawOutput: eventStream({ pluginRoot, referencePath, referenceContent }),
      pluginRoot,
      referencePath
    }),
    /unexpected Read tool_use event/
  );

  assert.throws(
    () => verifyClaudeReadEvent({
      rawOutput: eventStream({
        pluginRoot,
        referencePath,
        referenceContent,
        toolPath: otherPath,
        resultPath: otherPath
      }),
      pluginRoot,
      referencePath,
      referenceSha256: sha256(referenceContent)
    }),
    /matching Read tool_use event/
  );

  assert.throws(
    () => verifyClaudeReadEvent({
      rawOutput: eventStream({
        pluginRoot,
        referencePath,
        referenceContent,
        resultContent: "# Tampered\n"
      }),
      pluginRoot,
      referencePath,
      referenceSha256: sha256(referenceContent)
    }),
    /content hash/
  );

  assert.throws(
    () => verifyClaudeReadEvent({
      rawOutput: "{not-json}\n",
      pluginRoot,
      referencePath,
      referenceSha256: sha256(referenceContent)
    }),
    /malformed Claude stream event/
  );

  const outsidePath = path.join(tempRoot, "outside.md");
  fs.writeFileSync(outsidePath, "# Outside\n");
  const escapedReference = path.join(pluginRoot, "references", "escaped.md");
  fs.symlinkSync(outsidePath, escapedReference);
  assert.throws(
    () => verifyClaudeReadEvent({
      rawOutput: "",
      pluginRoot,
      referencePath: escapedReference,
      referenceSha256: sha256("# Outside\n")
    }),
    /inside the plugin root/
  );

  console.log("Claude access-event tests passed: 11 cases.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
