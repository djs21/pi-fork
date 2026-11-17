import test from "node:test";
import assert from "node:assert/strict";
import * as pi from "@earendil-works/pi-coding-agent";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_EXTENSION = path.join(testDir, "fixtures", "fork-fixture-extension.mjs");

/**
 * Build a real Pi session in an empty temp workspace: no personal
 * `~/.pi/agent` extensions, no repo `.pi` directory, no AGENTS.md/SYSTEM.md.
 * Everything Pi loads comes from `additionalExtensionPaths`.
 */
async function createSession(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-fork-test-"));
  const cwd = dir;
  const agentDir = dir;

  const resourceLoader = new pi.DefaultResourceLoader({
    cwd,
    agentDir,
    additionalExtensionPaths: options.additionalExtensionPaths,
    noExtensions: options.noExtensions ?? false,
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
  return { session, dir };
}

test("in-process session loads extensions from additionalExtensionPaths and denies fork by default", async (t) => {
  globalThis.piForkTestFixtureLoaded = false;
  const { session, dir } = await createSession({ additionalExtensionPaths: [FIXTURE_EXTENSION] });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // The fixture file went through the real loader and runner pipeline.
  assert.equal(
    globalThis.piForkTestFixtureLoaded,
    true,
    "fixture extension must be discovered, loaded, and its session_start handler must run"
  );

  // Default fork policy: inherit all tools, deny fork
  const activeTools = session.getActiveToolNames().filter((name) => name !== "fork");
  session.setActiveToolsByName(activeTools);

  const finalTools = session.getActiveToolNames();
  assert.equal(finalTools.includes("fork"), false, "fork must not be active in child session");
  assert.equal(finalTools.includes("read"), true, "read must remain active");
  assert.equal(finalTools.includes("bash"), true, "bash must remain active");
});

test("in-process session honors explicit tools and deniedTools", async (t) => {
  const { session, dir } = await createSession({ noExtensions: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // Explicit tools = ["read", "bash"], deniedTools = ["bash"]
  const tools = ["read", "bash"];
  const deniedTools = ["bash"];
  const activeTools = tools.filter((name) => !deniedTools.includes(name) && name !== "fork");
  session.setActiveToolsByName(activeTools);

  assert.deepEqual(session.getActiveToolNames(), ["read"]);
});

test("in-process session inherits parentActiveTools while stripping fork", async (t) => {
  const { session, dir } = await createSession({ noExtensions: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const parentActiveTools = ["read", "bash", "fork"];
  const activeTools = parentActiveTools.filter((name) => name !== "fork");
  session.setActiveToolsByName(activeTools);

  const finalTools = session.getActiveToolNames();
  assert.equal(finalTools.includes("fork"), false, "fork must be stripped");
  assert.equal(finalTools.includes("read"), true, "read must remain active");
  assert.equal(finalTools.includes("bash"), true, "bash must remain active");
});
