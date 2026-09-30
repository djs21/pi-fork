import test from "node:test";
import assert from "node:assert/strict";
import * as pi from "@earendil-works/pi-coding-agent";
import path from "node:path";
import os from "node:os";

test("in-process session inherits all tools and extensions while denying fork by default", async () => {
  const cwd = process.cwd();
  const agentDir = path.join(os.homedir(), ".pi", "agent");

  const resourceLoader = new pi.DefaultResourceLoader({
    cwd,
    agentDir,
    additionalExtensionPaths: undefined,
    noExtensions: false,
  });
  await resourceLoader.reload();

  const { session } = await pi.createAgentSession({
    cwd,
    agentDir,
    resourceLoader,
    sessionManager: pi.SessionManager.inMemory(),
    settingsManager: pi.SettingsManager.inMemory(),
    modelRegistry: new pi.ModelRegistry(),
  });

  await session.extensionRunner.emit({ type: "session_start" });

  // Default fork policy: inherit all tools, deny fork
  let activeTools = session.getActiveToolNames();
  const denied = new Set();
  const allowRecursiveFork = false;
  if (!allowRecursiveFork) {
    denied.add("fork");
  }
  activeTools = activeTools.filter((name) => !denied.has(name));
  session.setActiveToolsByName(activeTools);

  const finalTools = session.getActiveToolNames();
  assert.equal(finalTools.includes("fork"), false, "fork must not be active in child session");
  assert.equal(finalTools.includes("read"), true, "read must remain active");
  assert.equal(finalTools.includes("bash"), true, "bash must remain active");
});

test("in-process session honors explicit tools and deniedTools", async () => {
  const cwd = process.cwd();
  const agentDir = path.join(os.homedir(), ".pi", "agent");

  const resourceLoader = new pi.DefaultResourceLoader({
    cwd,
    agentDir,
    noExtensions: true,
  });
  await resourceLoader.reload();

  const { session } = await pi.createAgentSession({
    cwd,
    agentDir,
    resourceLoader,
    sessionManager: pi.SessionManager.inMemory(),
    settingsManager: pi.SettingsManager.inMemory(),
    modelRegistry: new pi.ModelRegistry(),
  });

  await session.extensionRunner.emit({ type: "session_start" });

  // Explicit tools = ["read", "bash"], deniedTools = ["bash"]
  const tools = ["read", "bash"];
  const deniedTools = ["bash"];
  let activeTools = [...tools];
  const denied = new Set(deniedTools);
  denied.add("fork");
  activeTools = activeTools.filter((name) => !denied.has(name));
  session.setActiveToolsByName(activeTools);

  assert.deepEqual(session.getActiveToolNames(), ["read"]);
});
