/**
 * Fixture extension for the in-process integration tests.
 *
 * Its only job is to prove that the real Pi loader discovers files passed via
 * `additionalExtensionPaths` and that the session runner executes their
 * `session_start` handlers. No mocks: the extension goes through the same
 * pipeline as a user-installed one.
 */
export default function forkFixtureExtension(pi) {
  pi.on("session_start", async () => {
    globalThis.piForkTestFixtureLoaded = true;
  });
}
