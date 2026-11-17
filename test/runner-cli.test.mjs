import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseInheritedCliArgs } from "../src/runner-cli.js";

test("forwards safe parent CLI flags and captures fallback settings", () => {
  const parsed = parseInheritedCliArgs([
    "/usr/bin/node",
    "pi",
    "--provider",
    "openrouter",
    "--api-key=secret",
    "--theme",
    "dark",
    "--model",
    "anthropic/claude-3-7-sonnet",
    "--thinking=high",
    "--tools",
    "read,bash",
    "--no-session",
    "--mode",
    "json",
    "--session",
    "/tmp/current.jsonl",
    "--fork",
    "/tmp/source.jsonl",
    "--system-prompt",
    "/tmp/parent-system.md",
    "--append-system-prompt",
    "/tmp/prompt.md",
    "--custom-flag",
    "value",
    "positional prompt text",
  ]);

  assert.deepEqual(parsed.extensionArgs, []);
  assert.deepEqual(parsed.alwaysProxy, [
    "--provider",
    "openrouter",
    "--api-key",
    "secret",
    "--theme",
    "dark",
    "--custom-flag",
    "value",
  ]);
  assert.equal(parsed.fallbackModel, "anthropic/claude-3-7-sonnet");
  assert.equal(parsed.fallbackThinking, "high");
  assert.equal(parsed.fallbackTools, "read,bash");
  assert.equal(parsed.fallbackNoTools, false);
});

test("resolves relative extension and resource paths against parent cwd", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-fork-cli-"));
  const extensionDir = path.join(tmpDir, "local-extension");
  const skillPath = path.join(tmpDir, "skills", "research", "SKILL.md");
  const sessionDir = path.join(tmpDir, ".sessions");
  fs.mkdirSync(extensionDir);
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(skillPath, "# skill\n");

  const previousCwd = process.cwd();
  process.chdir(tmpDir);

  try {
    const parsed = parseInheritedCliArgs([
      "/usr/bin/node",
      "pi",
      "-e",
      "./local-extension",
      "--extension=git:github.com/example/other-extension",
      "--skill",
      "./skills/research/SKILL.md",
      "--session-dir",
      "./.sessions",
    ]);

    assert.deepEqual(parsed.extensionArgs, [
      "-e",
      extensionDir,
      "--extension",
      "git:github.com/example/other-extension",
    ]);
    assert.deepEqual(parsed.alwaysProxy, [
      "--skill",
      skillPath,
      "--session-dir",
      sessionDir,
    ]);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
