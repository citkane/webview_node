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

#include "JsCallback.h"

using namespace Napi;

// JsCallback
// ********************************************************************************************************
JsCallback::JsCallback(const CallbackInfo &info)
    : ObjectWrap<JsCallback>(info), cbKind(wv_unknown), cbUid(cbCount) {

  std::lock_guard<std::mutex> lock(mtx);
  cbCount++;

  auto *context = new Reference<Napi::Value>(Persistent(info.This()));
  tsfn = static_cast<tsfn_t>(
      tsfn_t::New(info.Env(), info[0].As<Function>(), "tsfn", 0, 1, context));
  cbMap.emplace(cbUid, this);
}

Napi::Value JsCallback::getDispatchPtr(const CallbackInfo &info) {
  cbKind = wv_dispatch;
  auto ptr = reinterpret_cast<void *>(&dispatchCb);
  return External<void>::New(info.Env(), ptr);
}

Napi::Value JsCallback::getBindPtr(const CallbackInfo &info) {
  cbKind = wv_bind;
  auto ptr = reinterpret_cast<void *>(&bindCb);
  return External<void>::New(info.Env(), ptr);
}

Napi::Value JsCallback::getCbUid(const CallbackInfo &info) {
  auto const uid = Napi::Number::New(info.Env(), cbUid).As<Napi::Value>();
  return uid;
}
Napi::Value JsCallback::getArg(uint32_t argId) {
  std::lock_guard<std::mutex> lock(mtx);
  auto jsArgObj = argMap.at(argId)->Value().As<Napi::Object>();
  auto jsArg = jsArgObj.Get("arg");
  return jsArg;
};
void JsCallback::destroyArg(uint32_t argId) {
  std::lock_guard<std::mutex> lock(mtx);
  auto jsArgRef = argMap.at(argId);
  jsArgRef->Reset();
  argMap.erase(argId);
};
void JsCallback::setArg(const CallbackInfo &info) {
  std::lock_guard<std::mutex> lock(mtx);
  auto argId = info[1].ToNumber().Int32Value();
  auto argRef = new Reference<Napi::Value>(Persistent(info[0]));
  argMap.emplace(argId, argRef);
  if (cbKind == wv_dispatch) {
    cbQTally++;
  }
}
uint32_t JsCallback::cbCount = 0;

// Trampoline
// ********************************************************************************************************
std::mutex Trampoline::mtx;
std::map<uint32_t, JsCallback *> Trampoline::cbMap;

void Trampoline::dispatchCb(webview_t w, void *arg) {
  std::lock_guard<std::mutex> lock(mtx);
  if (reject(arg)) {
    return;
  }
  auto ids = getIds(arg);
  auto tsfn = getTsfn(ids.cbUid);
  auto tsfnData = makeTsfnData("", "", w, ids);
  tsfn->BlockingCall(tsfnData);
};

void Trampoline::bindCb(const char *id, const char *req, void *arg) {
  std::lock_guard<std::mutex> lock(mtx);
  if (reject(arg)) {
    return;
  }
  auto ids = getIds(arg);
  auto tsfn = getTsfn(ids.cbUid);
  auto tsfnData = makeTsfnData(id, req, nullptr, ids);
  tsfn->BlockingCall(tsfnData);
};

void Trampoline::callTsfn(Env env, Function callback, tsfnContext *context,
                          tsfnData_t *data) {

  auto self = getSelf(data->cbUid);
  auto jsArg = self->getArg(data->argId);
  if (self->cbKind == wv_dispatch) {
    auto jsW = getAddressFromPtr(env, data->w);
    try {
      callback.Call(context->Value(), {jsW, jsArg});
    } catch (const Napi::Error &e) {
      e.ThrowAsJavaScriptException();
    }
    self->destroyArg(data->argId);
    self->cbQTally--;
    if (self->cbStatus == cb_deferred && self->cbQTally == 0) {
      self->destroy(false);
    }
  }
  if (self->cbKind == wv_bind) {
    auto jsId = String::New(env, data->id);
    auto jsReq = String::New(env, data->req);
    try {
      callback.Call(context->Value(), {jsId, jsReq, jsArg});
    } catch (const Napi::Error &e) {
      e.ThrowAsJavaScriptException();
    }
  }
};

ids_t Trampoline::getIds(void *arg) {
  auto vctr = reinterpret_cast<std::vector<uint32_t> *>(arg);
  ids_t ids = {};
  ids.cbUid = (*vctr)[0];
  ids.argId = (*vctr)[1];
  return ids;
};
tsfnData *Trampoline::makeTsfnData(std::string id, std::string req, webview_t w,
                                   ids_t ids) {
  tsfnData_t data = {};
  data.id = id;
  data.req = req;
  data.w = w;
  data.cbUid = ids.cbUid;
  data.argId = ids.argId;
  return new tsfnData_t(data);
};
Trampoline::tsfn_t *Trampoline::getTsfn(uint32_t cbUid) {
  auto self = getSelf(cbUid);
  if (self == nullptr) {
    return nullptr;
  }
  return &self->tsfn;
};
JsCallback *Trampoline::getSelf(uint32_t cbUid) {
  int cbCount = cbMap.count(cbUid);
  if (cbCount == 0) {
    //The callback was cleaned up before being executed.
    return nullptr;
  }
  auto self = cbMap.at(cbUid);
  return self;
};
bool Trampoline::reject(void *arg) {
  if (arg == nullptr) {
    return true;
  }
  auto ids = getIds(arg);
  auto self = getSelf(ids.cbUid);
  if (self == nullptr) {
    return true;
  }
  if (self->cbStatus == cb_closed) {
    return true;
  }
  return false;
}

// Destructor: N-Api automatically handles the rest of the destruction after this.
// ********************************************************************************************************
void JsCallback::destroy(const CallbackInfo &info) {
  auto isShutdown = info[0].ToBoolean();
  destroy(isShutdown);
};
void JsCallback::destroy(bool isShutdown) {
  std::lock_guard<std::mutex> lock(mtx);
  if (this->cbStatus == cb_closed) {
    return;
  }
  if (!isShutdown && this->cbStatus != cb_closing && this->cbQTally > 0) {
    this->cbStatus = cb_deferred;
    return;
  }
  this->cbStatus = cb_closed;
  this->tsfn.Abort();
  for (auto &pair : this->argMap) {
    auto argRef = pair.second;
    argRef->Reset();
  }
  this->argMap.clear();
  cbMap.erase(this->cbUid);
  delete this;
}

// N-Api module initialiser
// ********************************************************************************************************
Object JsCallback::Init(Napi::Env env, Object exports) {
  Function func = DefineClass(
      env, "JsCallback",
      {
          InstanceMethod("setArg", &JsCallback::setArg),
          InstanceMethod("destroy", &JsCallback::destroy),
          InstanceAccessor<&JsCallback::getDispatchPtr>("dispatchPtr"),
          InstanceAccessor<&JsCallback::getBindPtr>("bindPtr"),
          InstanceAccessor<&JsCallback::getCbUid>("cbUid"),
      });

  exports.Set("JsCallback", func);
  return exports;
}

Object Init(Napi::Env env, Napi::Object exports) {
  return JsCallback::Init(env, exports);
};

NODE_API_MODULE(addon, Init);
