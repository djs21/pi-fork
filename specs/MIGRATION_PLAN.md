# In-Process Runtime Migration

Migrasi pi-fork dari subprocess ke in-process runtime.

## Context

pi-fork saat ini spawn child process baru untuk setiap fork. Ini boros: ~120MB memori, ~2-5 detik startup.

Solution: pakai in-process runtime via `createAgentSession()`. Hasil: ~3MB memori, ~0.1 detik startup.

Subprocess fallback tetap ada untuk edge cases (environment isolation, offline mode).

## Phases

### Phase 1: Config & Boundary
- Tambah field `runtime` ke ForkConfig
- Tambah field `tools`, `deniedTools`, `allowRecursiveFork`
- Update `loadConfig()` untuk parse field baru
- Test: config lama tetap jalan

### Phase 2: Extract Subprocess Runner
- Pindahkan logic spawn ke `runSubprocess.ts`
- Buat boundary function `runFork()`
- Test: behavior tetap sama

### Phase 3: In-Process Runner (INTI)
- Buat `runInProcess.ts`
- Core flow: snapshot → SessionManager → AgentSession → prompt → result
- Handle abort, error, cleanup
- Test: in-process path fungsional

### Phase 4: Wiring & Tool Filtering
- Sambungin ke tool `fork`
- Runtime selection: auto → in-process, fallback subprocess
- Tool filtering setelah extension loaded
- Test: recursive fork bisa di-disable

### Phase 5: Cleanup & Documentation
- Cleanup unused code (jangan hapus, comment/flag)
- Update README
- Add ponytail markers
- Final test
