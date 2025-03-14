
# MIT License
#
# Copyright (c) 2025 Michael Jonker
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

# pylint: disable=missing-module-docstring
# pylint: disable=expression-not-assigned
# pylint: disable=pointless-statement

{
    "variables": {
        "NODE_DEPS": "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except_all",
        "NODE_INCLUDE": "<!(node -p \"require('node-addon-api').include\")",
        "UNIX_LIKE": "OS=='linux' or OS=='freebsd' or OS=='openbsd' or OS=='solaris'",
        "MAC_OS": "OS=='mac'",
        "WINDOWS": "OS=='win'",
        "C_STD": "-std=c++17",
        "conditions": [
            ["<(UNIX_LIKE) or <(MAC_OS)", {
                "SRC_DIR": "./<!(echo $SRC_DIR)",
                "SWIG_TARGET": "./<!(echo $SWIG_TARGET)",
                "WEBVIEW_INCLUDE_DIR": "./<!(echo $WEBVIEW_DIR)/core/include/webview",
                "NATIVE_INCLUDE_DIR": "./<!(echo $NATIVE_INCLUDE_DIR)",
                "NATIVE_SRC_DIR": "./<!(echo $NATIVE_SRC_DIR)",
            }],
            ["<(WINDOWS)", {
                "SRC_DIR": "<(module_root_dir)/<!(echo %SRC_DIR%)",
                "SWIG_TARGET": "<(module_root_dir)/<!(echo %SWIG_TARGET%)",
                "WEBVIEW_INCLUDE_DIR": "<(module_root_dir)/<!(echo %WEBVIEW_DIR%)/core/include/webview",
                "NATIVE_INCLUDE_DIR": "<(module_root_dir)/<!(echo %NATIVE_INCLUDE_DIR%)",
                "NATIVE_SRC_DIR": "<(module_root_dir)/<!(echo %NATIVE_SRC_DIR%)",
                "MSWV2_DIR": "<(module_root_dir)/<!(echo %RESOURCE_DIR%)/<!(echo %MSWV2_TAG%).<!(echo %MSWV2_VERSION%)",
            }]
        ]
    },
    "targets": [
        {
            "target_name": "webview",
            "include_dirs": ["<(NODE_INCLUDE)", "<(WEBVIEW_INCLUDE_DIR)", "<(NATIVE_INCLUDE_DIR)"],
            "sources": ["<(SWIG_TARGET)"],
            "dependencies": ["<(NODE_DEPS)"],
            "cflags": ["<(C_STD)", "-O2"],
            "cflags_cc": ["<(C_STD)", "-O2"],
            "conditions": [
                ["<(UNIX_LIKE)", {
                    "include_dirs": [" <!(pkg-config --cflags gtk4 webkitgtk-6.0)"],
                    "libraries": [" <!(pkg-config --libs gtk4 webkitgtk-6.0)", "-ldl"],
                }],
                ["<(MAC_OS)", {"xcode_settings": {
                    "GCC_SYMBOLS_PRIVATE_EXTERN": "YES",
                    "OTHER_LDFLAGS": ["-framework", "WebKit", "-ldl"],
                }}],
                ["<(WINDOWS)", {
                    "variables": {
                        "conditions": [
                            ["target_arch=='x64'", {"WV2_LIB": "x64"}],
                            ["target_arch=='ia32'", {"WV2_LIB": "x86"}],
                            ["target_arch=='arm64'", {"WV2_LIB": "arm64"}]
                        ],
                    },
                    "include_dirs": ["<(MSWV2_DIR)/include"],
                    "defines": [
                        "WEBVIEW_MSWEBVIEW2_BUILTIN_IMPL=0",
                        "WEBVIEW_MSWEBVIEW2_EXPLICIT_LINK=0",
                        "WEBVIEW_STATIC=1"
                    ],
                    "msbuild_settings": {"ClCompile": {"LanguageStandard": "stdcpp17"}},
                    "msvs_settings": {"VCCLCompilerTool": {
                        "Optimization": 2,
                        "RuntimeLibrary": 0,
                    }},
                    "libraries": [
                        "advapi32.lib",
                        "ole32.lib",
                        "shell32.lib",
                        "shlwapi.lib",
                        "user32.lib",
                        "version.lib",
                        "<(MSWV2_DIR)/<(WV2_LIB)/WebView2LoaderStatic.lib"
                    ]
                }]
            ],
            "actions": [{
                "action_name": "clone_webview",
                "inputs": [],
                "outputs": ["resource"],
                "action": [
                    "node",
                    "<(SRC_DIR)/bootstrap.js",
                    "clone_webview"
                ]
            }]
        },
        {
            "target_name": "jscallback",
            "defines": ["V8_DEPRECATION_WARNINGS=1"],
            "dependencies": ["<(NODE_DEPS)"],
            "cflags": ["<(C_STD)", "-O2"],
            "cflags_cc": ["<(C_STD)", "-O2"],
            "sources": ["<(NATIVE_SRC_DIR)/JsCallback.cc"],
            "include_dirs": ["<(NODE_INCLUDE)", "<(NATIVE_INCLUDE_DIR)"],
            "conditions": [
                ["<(MAC_OS)", {"xcode_settings": {
                    "GCC_SYMBOLS_PRIVATE_EXTERN": "YES"}}],
                ["<(WINDOWS)", {
                    "msbuild_settings": {"ClCompile": {"LanguageStandard": "stdcpp17"}},
                    "msvs_settings": {"VCCLCompilerTool": {
                        "Optimization": 2,
                        "RuntimeLibrary": 0,
                    }},
                }]
            ]
        }
    ]

}
