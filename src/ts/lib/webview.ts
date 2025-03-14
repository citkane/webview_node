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
 * Compiled from "src/ts/webview.ts"
 * Consult the Typescript source file for enhanced readability and comments.
 * Refer to the Typescript source file for licensing.
 */

const libWv = require("bindings")("./webview.node");

/** Size hints for use with `webview_set_size` */
enum webview_hint {
  WEBVIEW_HINT_NONE,
  WEBVIEW_HINT_MIN,
  WEBVIEW_HINT_MAX,
  WEBVIEW_HINT_FIXED,
}
/** Webview handle kinds for use with `webview_get_native_handle` */
enum webview_native_handle_kind {
  WEBVIEW_NATIVE_HANDLE_KIND_UI_WINDOW,
  WEBVIEW_NATIVE_HANDLE_KIND_UI_WIDGET,
  WEBVIEW_NATIVE_HANDLE_KIND_BROWSER_CONTROLLER,
}

export { libWv, webview_hint, webview_native_handle_kind };
