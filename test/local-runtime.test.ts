import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localRuntime } from "../domain/local-runtime";

async function project() { const root = await mkdtemp(join(tmpdir(), "maxinal-runtime-")); await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { start: "node server.js" } })); await writeFile(join(root, "server.js"), `const http=require("http"); const p=process.argv[process.argv.indexOf("-p")+1]; const s=http.createServer((_,r)=>r.end("ready")); s.listen(Number(p),()=>console.log("ready on 127.0.0.1:"+s.address().port));`); return root; }
test("local runtime allocates distinct ports and remains alive until stopped", async () => { const a = await project(); const b = await project(); try { const [one, two] = await Promise.all([localRuntime.start(a), localRuntime.start(b)]); assert.equal(one.ok, true); assert.equal(two.ok, true); if (!one.ok || !two.ok) return; const portOne = new URL(one.session.url).port; const portTwo = new URL(two.session.url).port; assert.notEqual(portOne, "0"); assert.notEqual(portOne, portTwo); assert.equal((await fetch(one.session.url)).ok, true); assert.equal((await fetch(two.session.url)).ok, true); assert.equal((await one.session.stop()).ok, true); await assert.rejects(() => fetch(one.session.url)); assert.equal((await two.session.stop()).ok, true); } finally { await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); } });
test("local runtime preserves an explicitly requested port", async () => { const root = await project(); const port = 38127; try { const result = await localRuntime.start(root, port); assert.equal(result.ok, true); if (result.ok) { assert.equal(new URL(result.session.url).port, String(port)); await result.session.stop(); } } finally { await rm(root, { recursive: true, force: true }); } });
