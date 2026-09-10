/**
 * In-process fork runner.
 *
 * Runs a fork using Pi's AgentSession API directly, without spawning a child process.
 * Much faster (~0.1s startup vs ~2-5s) and lighter (~3MB vs ~120MB per fork).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { buildForkTaskPrompt } from "./runSubprocess.ts";
import {
  type ForkDetails,
  type ForkEffortState,
  type ForkResult,
  emptyUsage,
  normalizeCompletedResult,
} from "./types.ts";

type OnUpdateCallback = (partial: AgentToolResult<ForkDetails>) => void;

export interface RunInProcessOptions {
  cwd: string;
  agentDir: string;
  task: string;
  forkSessionSnapshotJsonl: string;
  extensions?: string[] | null;
  signal?: AbortSignal;
  onUpdate?: OnUpdateCallback;
  makeDetails: (results: ForkResult[]) => ForkDetails;
  effort?: ForkEffortState;
  modelRegistry: ExtensionContext["modelRegistry"];
  modelRuntime: ExtensionContext["modelRuntime"];
}

function cleanupTempDir(dir: string | null): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export async function runInProcess(opts: RunInProcessOptions): Promise<ForkResult> {
  const {
    cwd,
    agentDir,
    task,
    forkSessionSnapshotJsonl,
    extensions,
    signal,
    onUpdate,
    makeDetails,
    effort,
    modelRegistry,
    modelRuntime,
  } = opts;

  if (!forkSessionSnapshotJsonl.trim()) {
    const failedResult: ForkResult = {
      task,
      exitCode: 1,
      messages: [],
      stderr: "Cannot fork: missing parent session snapshot context.",
      usage: emptyUsage(),
      stopReason: "error",
      errorMessage: "Cannot fork: missing parent session snapshot context.",
    };
    if (effort) failedResult.effort = effort;
    return failedResult;
  }

  let tmpDir: string | null = null;
  let session: AgentSession | null = null;
  let unsubscribe: (() => void) | null = null;
  let wasAborted = false;

  try {
    // 1. Write snapshot to temp file
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-fork-"));
    const tmpPath = path.join(tmpDir, "fork.jsonl");
    fs.writeFileSync(tmpPath, forkSessionSnapshotJsonl, { encoding: "utf-8", mode: 0o600 });

    // 2. Open session from snapshot
    const sessionManager = SessionManager.open(tmpPath);
    const settingsManager = SettingsManager.inMemory();

    // 3. Setup extension loader
    const resolvedAgentDir = agentDir || path.join(os.homedir(), ".pi", "agent");
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir: resolvedAgentDir,
      additionalExtensionPaths: extensions && extensions.length > 0 ? extensions : undefined,
    });

    // 4. Create agent session
    const result: ForkResult = {
      task,
      exitCode: -1,
      messages: [],
      stderr: "",
      usage: emptyUsage(),
    };
    if (effort) result.effort = effort;

    const sessionResult = await createAgentSession({
      cwd,
      agentDir,
      resourceLoader,
      sessionManager,
      settingsManager,
      authStorage: modelRegistry.authStorage,
      modelRegistry,
      modelRuntime,
      model: effort?.profile?.id && effort?.profile?.provider
        ? modelRegistry.find(effort.profile.provider, effort.profile.id)
        : undefined,
      thinkingLevel: effort?.profile?.thinking as any,
    });

    session = sessionResult.session;

    // 5. Trigger extension registration
    await session.extensionRunner.emit({ type: "session_start" });

    // 6. Subscribe to events for usage tracking
    const emitUpdate = () => {
      onUpdate?.({
        content: [
          {
            type: "text",
            text: `[in-process] Task: ${task}\nTurns: ${result.usage.turns}\nInput: ${result.usage.input} tokens\nOutput: ${result.usage.output} tokens`,
          },
        ],
        details: makeDetails([result]),
      });
    };

    unsubscribe = session.subscribe((event: any) => {
      if (event.type === "turn_end") {
        result.usage.turns++;
        if (event.message?.usage) {
          result.usage.input += event.message.usage.input ?? 0;
          result.usage.output += event.message.usage.output ?? 0;
          result.usage.cacheRead += event.message.usage.cacheRead ?? 0;
          result.usage.cacheWrite += event.message.usage.cacheWrite ?? 0;
        }
        emitUpdate();
      }
    });

    // 7. Handle abort
    if (signal) {
      const abortHandler = () => {
        wasAborted = true;
        session?.abort().catch(() => {});
      };
      if (signal.aborted) abortHandler();
      else signal.addEventListener("abort", abortHandler, { once: true });
    }

    // 8. Run the task
    const prompt = buildForkTaskPrompt(task);
    await session.prompt(prompt);

    // 9. Extract result from session messages
    const messages = session.messages ?? [];
    result.messages = messages;

    // Get the last assistant message as output
    const lastAssistant = messages
      .filter((m: any) => m.role === "assistant")
      .pop();
    const outputText = lastAssistant?.content
      ?.filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") ?? "";

    if (outputText) {
      result.stopReason = "completed";
    } else {
      result.stopReason = "error";
      result.stderr = "No output from in-process session";
    }

    result.exitCode = 0;
    return normalizeCompletedResult(result, wasAborted);
  } catch (err: any) {
    const errorResult: ForkResult = {
      task,
      exitCode: 1,
      messages: [],
      stderr: err?.message ?? String(err),
      usage: emptyUsage(),
      stopReason: "error",
      errorMessage: err?.message ?? String(err),
    };
    if (effort) errorResult.effort = effort;
    return errorResult;
  } finally {
    // 10. Cleanup
    unsubscribe?.();
    session?.dispose();
    cleanupTempDir(tmpDir);
  }
}
