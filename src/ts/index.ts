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

/*!
 * Compiled from "src/ts/index.ts"
 * Consult the Typescript source file for enhanced readability and comments.
 * Refer to the Typescript source file for licensing.
 */

import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { JsCallback } from "./lib/JsCallback.js";
import { Ipc } from "./lib/Ipc.js";
import {
  libWv as wv,
  webview_hint,
  webview_native_handle_kind,
} from "./lib/webview.js";

const ipc = new Ipc();
const fileName = process.argv[1];

if (process.argv[2] === "spawn") {
  ipc.makeClient(() => runSpawn());
} else {
  isMainThread ? runMainThread(fileName) : runWorkerThread(fileName); // ********** The main and worker threads' code is combined into one file for convenience.
}

/** ***********************************************************
 * Runs the main GUI thread, which is going to be blocked by Webview
 * ********************************************************* */
function runMainThread(fileName: string) {
  const w = wv.webview_create(1, null);
  wv.webview_set_size(w, 1200, 1200, webview_hint.WEBVIEW_HINT_NONE);
  wv.webview_set_title(w, "Thread-safe Webview");
  wv.webview_set_html(w, getHTML());

  const worker = new Worker(fileName);
  worker.on("exit", (code) => {});
  worker.on("error", (message) => {
    throw message;
  });
  worker.on("online", () => {
    infoLog(w);
    worker.postMessage(w); // ******************************* Pass the Webview instance pointer to the main thread.
  });
  worker.once("message", () => {
    wv.webview_run(w); // *************************************** The worker thread is now blocked until Webview is terminated.
    JsCallback.destroy(); // ***************************** Free all cb memory if the window is closed by the user.
    ipc.destroy();
    wv.webview_destroy(w);
  });
}

/** *************************************************************
 * Runs the user application worker thread, which is not going to be blocked by Webview
 * *********************************************************** */
function runWorkerThread(fileName: string) {
  parentPort!.once("message", (w) => {
    ipc.serve(wv, w);
    parentPort!.postMessage("run Webview");
    ipc.fork(fileName);
    // ******************************************************** Create a dispatch JS cb function
    const dispatchCbFn = (w: bigint, arg: any) => {
      const message = "Dispatch (worker to main thread) returns:";
      console.log(message, `${typeof arg}:`, { w, arg });
    };
    const dpCb = new JsCallback(w, "dispatch", dispatchCbFn);

    // ******************************************************** Create and bind a JS cb function
    const bindCbFn = (
      argIndexOrBoundFn: number | Function,
      maybeBoundArg?: any
    ) => {
      const i = typeof maybeBoundArg !== "undefined" ? argIndexOrBoundFn : null;
      const infoMessage =
        i !== null
          ? "The bound fn was called with a parameter value, it will return to the window an indexed arg value:"
          : "The bound fn was called without a parameter value, it will return to the window it's bound `arg`:";
      console.info(infoMessage, argIndexOrBoundFn);
      return i === null ? argIndexOrBoundFn : getUserArgs()[i as number];
    };
    const bindCb = new JsCallback(w, "bind", bindCbFn);
    const boundArg = bindCb.arg("I am the bound `arg`");
    wv.webview_bind(w, "boundFn", bindCb.ptr, boundArg);

    setTimeout(() => {
      // ***************************************************** Call the bound JS cb function from the Webview window.
      wv.webview_eval(w, `boundFn().then(res => appendBoundRes(res));`);
      wv.webview_eval(w, `boundFn(0).then(res => appendBoundRes(res));`);
      wv.webview_eval(w, `boundFn(1).then(res => appendBoundRes(res));`);
      wv.webview_eval(w, `boundFn(2).then(res => appendBoundRes(res));`);
      wv.webview_eval(w, `boundFn(3).then(res => appendBoundRes(res));`);

      // ****************************************************** Dispatch the cb function to the worker thread.
      const args = getUserArgs();
      wv.webview_dispatch(w, dpCb.ptr, dpCb.arg());
      wv.webview_dispatch(w, dpCb.ptr, dpCb.arg(args[0]));
      wv.webview_dispatch(w, dpCb.ptr, dpCb.arg(args[1]));
      wv.webview_dispatch(w, dpCb.ptr, dpCb.arg(args[2]));
      wv.webview_dispatch(w, dpCb.ptr, dpCb.arg(args[3]));
      dpCb.close(); //**************************************** We are done with the dispatch cb function, so free the memory.
    }, 1000);

    setTimeout(() => {
      bindCb.close(); // ************************************* We are done with the bind cb function, so free the memory
      //wv.webview_unbind(w, "boundFn");
      //wv.webview_terminate(w); // **************************** Terminate the Webview window.
    }, 1500);
  });
}

/** *************************************************************
 * Runs a spawned client in a new process to remote-control Webview
 * *********************************************************** */
function runSpawn() {
  setTimeout(() => {
    ipc.write("webview_unbind", "boundFn");
    ipc.write("webview_terminate");
  }, 5000);
}
/** ***********************************************************
 * Utilities for the example
 * ********************************************************* */
function getHTML() {
  return `
  <html>
    <body>
      <p>
        <h1>Hello Webview</h1>
        Multi-thread for Node JS.</br>This example will close itself in a few seconds.
      </p>
      <div id="bound">
        <h3>Returned values from the bound cb function:</h3>
      </div>
    </body>
    <script>
      window.appendBoundRes = function(res){
        res = typeof res !== "string" ? JSON.stringify(res, null, 4) : res;
        const p = "<p>" + res + "</p>";
        document.getElementById("bound").innerHTML += p;
      }
    </script>
  </html>
  `;
}
function getUserArgs() {
  return [
    { val: "I am an `Object` arg" },
    ["I am an `Object` array arg"],
    123.321,
    "etc...",
  ];
}
function infoLog(webview_t: bigint) {
  console.info("Webview version:", wv.webview_version());
  const ui_window = wv.webview_get_window(webview_t);
  const kind_ui_widget = wv.webview_get_native_handle(
    webview_t,
    webview_native_handle_kind.WEBVIEW_NATIVE_HANDLE_KIND_UI_WIDGET
  );
  const kind_browser_controller = wv.webview_get_native_handle(
    webview_t,
    webview_native_handle_kind.WEBVIEW_NATIVE_HANDLE_KIND_BROWSER_CONTROLLER
  );
  const kind_ui_window = wv.webview_get_native_handle(
    webview_t,
    webview_native_handle_kind.WEBVIEW_NATIVE_HANDLE_KIND_UI_WINDOW
  );
  console.info("Webview handle kinds:", {
    webview_t,
    ui_window,
    kind_ui_window,
    kind_browser_controller,
    kind_ui_widget,
  });
}

export {};
