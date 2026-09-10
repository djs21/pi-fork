/**
 * Fork runner boundary.
 *
 * Selects between in-process and subprocess runners based on config.
 * This is the single entry point for all fork execution.
 */

import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ForkConfig, ForkRuntime } from "./config.ts";
import { runInProcess, type RunInProcessOptions } from "./runInProcess.ts";
import { runSubprocess, type RunSubprocessOptions, type ContextWindowResolver } from "./runSubprocess.ts";
import {
  type ForkDetails,
  type ForkEffortState,
  type ForkResult,
} from "./types.ts";

type OnUpdateCallback = (partial: AgentToolResult<ForkDetails>) => void;

export interface RunForkOptions {
  cwd: string;
  agentDir: string;
  task: string;
  forkSessionSnapshotJsonl: string;
  config: ForkConfig;
  signal?: AbortSignal;
  onUpdate?: OnUpdateCallback;
  makeDetails: (results: ForkResult[]) => ForkDetails;
  effort?: ForkEffortState;
  modelRegistry: ExtensionContext["modelRegistry"];
  modelRuntime: ExtensionContext["modelRuntime"];
  resolveContextWindow?: ContextWindowResolver;
}

function shouldUseSubprocess(config: ForkConfig): boolean {
  // Force subprocess if explicitly requested
  if (config.runtime === "subprocess") return true;

  // Force in-process if explicitly requested
  if (config.runtime === "in-process") return false;

  // Auto: use subprocess only if environment isolation is needed
  // (environment config is non-empty)
  return Object.keys(config.environment).length > 0;
}

export async function runFork(opts: RunForkOptions): Promise<ForkResult> {
  const {
    cwd,
    agentDir,
    task,
    forkSessionSnapshotJsonl,
    config,
    signal,
    onUpdate,
    makeDetails,
    effort,
    modelRegistry,
    modelRuntime,
    resolveContextWindow,
  } = opts;

  const useSubprocess = shouldUseSubprocess(config);

  if (useSubprocess) {
    // Subprocess path: needs environment isolation
    return runSubprocess({
      cwd,
      task,
      forkSessionSnapshotJsonl,
      extensions: config.extensions,
      environment: config.environment,
      offline: config.offline,
      signal,
      onUpdate,
      makeDetails,
      effort,
      resolveContextWindow,
    });
  }

  // In-process path: default, fast, lightweight
  return runInProcess({
    cwd,
    agentDir,
    task,
    forkSessionSnapshotJsonl,
    extensions: config.extensions,
    signal,
    onUpdate,
    makeDetails,
    effort,
    modelRegistry,
    modelRuntime,
  });
}
