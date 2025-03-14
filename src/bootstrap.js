/*
 * MIT License
 *
 * Copyright (c) 2025 Michael Jonker
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const { execSync, spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { createHash } = require("crypto");
const { dirname, join } = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
require("dotenv").config();

const ctx = process.argv[2];
const { env } = process;

const nugetExe = `${env.RESOURCE_DIR}/nuget.exe`;
const nugetURL = `https://dist.nuget.org/win-x86-commandline/${env.NUGET_VERSION}/nuget.exe`;

if (os.platform() === "win32") {
  fetchNuget()
    .then(downloadMsWebView2)
    .catch((err) => {
      throw err;
    });
}

switch (ctx) {
  case "npm_i_dev":
    installDev();
    break;
  case "clone_webview":
    cloneWv();
    break;
  case "npm_i":
    installDev();
    buildJs();
    break;
  case "build_webview":
    buildWebview("configure").catch((err) => {
      throw err;
    });
    break;
  case "test":
    fetchNuget();
    break;
}

function installDev() {
  const command = `npm i --include=dev --ignore-scripts=true`;
  execSync(command);
}

function buildJs() {
  const command = `npx tsc`;
  execSync(command);
}

function cloneWv() {
  const clone_dir = process.env.WEBVIEW_DIR;
  if (existsSync(clone_dir)) return;
  const command = `git clone ${env.WEBVIEW_URL} ${clone_dir}`;
  execSync(command);
}

async function buildWebview(action) {
  let error;
  await new Promise((resolve, reject) => {
    const comm = spawn("node-gyp", [action]);
    comm.stdout.on("data", (data) => {
      console.log(`${data}`.trim());
    });
    comm.stderr.on("data", (data) => {
      error = `${data}`;
    });
    comm.on("close", async (code) => {
      if (code !== 0) return reject(error);
      if (action === "configure")
        await buildWebview("build").catch((err) => {
          reject(err);
        });
      resolve();
    });
  });
}

async function fetchNuget() {
  await new Promise(async (resolve, reject) => {
    if (fs.existsSync(nugetExe)) return resolve(true);
    const nugetDir = dirname(nugetExe);
    if (!fs.existsSync(nugetDir)) fs.mkdirSync(nugetDir, { recursive: true });
    console.info("Downloading nuget.exe...");
    try {
      const res = await fetch(nugetURL);
      if (!res.ok)
        return reject(
          `HTTP error downloading nuget.exe! status: ${res.status}`
        );
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      checksum(buffer, env.NUGET_CHECKSUM);
      fs.writeFileSync(nugetExe, buffer, { mode: 0o755 });
    } catch (err) {
      reject(err);
    }
  });
}

function downloadMsWebView2() {
  const mswv2Dir = join(
    env.RESOURCE_DIR,
    `${env.MSWV2_TAG}.${env.MSWV2_VERSION}`
  );
  if (fs.existsSync(mswv2Dir)) return;

  console.info("Downloading Microsoft.Web.WebView2 with nuget.exe...");
  const command = `${nugetExe} install ${env.MSWV2_TAG} -Version ${env.MSWV2_VERSION} -OutputDirectory ${env.RESOURCE_DIR}`;
  execSync(command);
}

function checksum(buffer, checksum) {
  const hash = createHash("sha256").update(buffer).digest("hex");
  if (hash !== checksum) {
    const message = `Checksum failed: ${hash} !== ${checksum}`;
    throw new Error(message);
  }
  console.info("Checksums match.");
}
