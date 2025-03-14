include .env
export

ifeq ($(OS), Windows_NT) #################### Windows specific commands

	redirect_stdout = >NUL 2>&1
define norm_winpath
	$(eval result := $(subst /,\,${1}))
	${result}
endef
define mk_dir
	$(eval path := $(call norm_winpath,${1})); \
	mkdir path
endef
define rm
	$(eval path := $(call norm_winpath,${1})); \
	del /f /q path
endef
define cp
	$(eval src := $(call norm_winpath,${1})); \
	$(eval targ := $(call norm_winpath,${2})); \
	copy ${src} ${targ}
endef
define rm_dir
	$(eval path := $(call norm_winpath,${1})); \
	if exist ${path} del /s /f /q ${path}
endef

else ######################################## Unix-like specific commands

	redirect_stdout = >/dev/null 2>&1
define norm_winpath
	${1}
endef
define mk_dir
	mkdir -p ${1}
endef
define rm
	rm -f ${1}
endef
define cp
	cp ${1} ${2}
endef
define rm_dir
	rm -rf ${1}
endef

endif ####################################### end OS specific commands

.PHONY: swig clean configure build js nuget uninstall npm_i_dev clone
all: swig configure js nuget
build:
	npx node-gyp build
uninstall: clean
	$(call rm_dir,node_modules); \
	$(call rm,package-lock.json)
clean:
	$(call rm_dir,${BUILD_DIR}); \
	$(call rm_dir,${JS_DIR}); \
	$(call rm,${SWIG_TARGET}); \
	$(call rm,${COMPILE_COMMDS_TARG})
swig: clone
	swig -DSWIG_WEBVIEW_I="${WEBVIEW_DIR}/webview.i" -c++ -javascript -napi -o "${SWIG_TARGET}" "${SRC_DIR}/webview.napi.i";
js:
	npx tsc
nuget:
	node ${NODE_PREINSTALL} ${NUGET_EXE}
configure: npm_i_dev
	npx node-gyp configure -- -f gyp.generator.compile_commands_json.py $(redirect_stdout);\
	$(call cp,${BUILD_DIR}/Release/compile_commands.json,compile_commands.json);\
	npx node-gyp clean;\
	npx node-gyp configure
npm_i_dev:
	node "${SRC_DIR}/bootstrap.js" npm_i_dev
clone:
	node "${SRC_DIR}/bootstrap.js" clone_webview

	