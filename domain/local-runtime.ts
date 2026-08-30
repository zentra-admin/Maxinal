import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { RuntimeManager, RuntimeSession } from "./runtime";

export const localRuntime: RuntimeManager = {
  async start(projectLocation, requestedPort) {
    try { await access(`${projectLocation}/package.json`); }
    catch { return { ok: false, error: { code: "INVALID_PROJECT" as const, message: "Generated project has no package.json." } }; }
    const child = spawn("npm", ["run", "start", "--", "-p", String(requestedPort ?? 0)], { cwd: projectLocation, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let actualPort = requestedPort;
    const capture = (chunk: Buffer) => { output += chunk.toString(); const match = output.match(/(?:localhost|0\.0\.0\.0|127\.0\.0\.1):([0-9]+)/); if (match) actualPort = Number(match[1]); };
    child.stdout.on("data", capture); child.stderr.on("data", capture);
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) return { ok: false, error: { code: "PROCESS_FAILURE" as const, message: `Process exited with ${child.exitCode}.` } };
      if (actualPort) { try { const response = await fetch(`http://127.0.0.1:${actualPort}`); if (response.ok) { const url = `http://127.0.0.1:${actualPort}`; const session: RuntimeSession = { url, async stop() { return new Promise(resolve => { if (child.exitCode !== null) return resolve({ ok: true }); child.once("exit", () => resolve({ ok: true })); child.kill("SIGTERM"); }); } }; return { ok: true, session }; } } catch { /* still starting */ } }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    child.kill("SIGTERM");
    return { ok: false, error: { code: "TIMEOUT" as const, message: `Generated project did not become available. ${output.slice(-200)}` } };
  }
};
