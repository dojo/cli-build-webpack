# @dojo/cli-build-webpack

[![Build Status](https://travis-ci.org/dojo/cli-build.svg?branch=master)](https://travis-ci.org/dojo/cli-build-webpack)
[![Build status](https://ci.appveyor.com/api/projects/status/31du0respjt6p98i/branch/master?svg=true)](https://ci.appveyor.com/project/Dojo/cli-build/branch/master)
[![codecov](https://codecov.io/gh/dojo/cli-build/branch/master/graph/badge.svg)](https://codecov.io/gh/dojo/cli-build-webpack)
[![npm version](https://badge.fury.io/js/%40dojo%2Fcli-build-webpack.svg)](https://badge.fury.io/js/%40dojo%2Fcli-build-webpack)

The official dojo 2 build command.

*WARNING* This is _beta_ software. While we do not anticipate significant changes to the API at this stage, we may feel the need to do so. This is not yet production ready, so you should use at your own risk.

- [Usage](#usage)
- [Features](#features)
  - [Building](#building)
  - [Building a custom element](#building-a-custom-element)
  - [Feature optimization](#feature-optimization)
  - [Eject](#eject)
  - [3rd party library integration](#interop-with-external-libraries)
- [How do I contribute?](#how-do-i-contribute)
  - [Installation](#installation)
  - [Testing](#testing)
- [Licensing information](#licensing-information)

## Usage

To use `@dojo/cli-build` in a single project, install the package:

```bash
npm install @dojo/cli-build-webpack
```

to use `@dojo/cli-build-webpack` in every project, install the project globally:

```bash
npm install -g @dojo/cli-build-webpack
```

## Features

`@dojo/cli-build-webpack` is an optional command for the [`@dojo/cli`](https://github.com/dojo/cli).

### Building

To build a Dojo 2 application for publishing:

```bash
dojo build webpack
```

This command will output the built files to the `dist` directory.  After running this command, you can open the `dist/index.html` file to see your application.

You can also build in watch mode, which will automatically rebuild your application when it changes:

```bash
dojo build webpack -w
```

When using watch mode, you can specify a port, or port range, to use when determining which port to serve your application on.

```bash
# a single port
dojo build webpack -w --port=8080

# a list of ports
dojo build webpack -w --port=8080,8181

# a range of ports
dojo build webpack -w --port=9010:9000
```

The watch server will use the first unused port in the list you specified. Default port range is 9990-9999.

`@dojo/cli-build-webpack` can be customized further. Use the help option to see everything you can do:

```bash
dojo build webpack --help
```

### Building a custom element

`@dojo/cli-build-webpack` can also build custom web elements as per the [custom web v1 specification](https://www.w3.org/TR/2016/WD-custom-elements-20161013/). Custom elements are built by providing the name of a [custom element descriptor](https://github.com/dojo/widget-core#web-components).

```bash
dojo build webpack --element=src/path/to/createTheSpecialElement.ts
```

This will output a `dist/the-special` directory containing:

* `the-special.js` - JavaScript file containing code specific to the `TheSpecial` widget.
* `widget-core.js` - JavaScript file containing shared widget code. This is separated to allow for better caching by the browser.
* `the-special.css` - CSS relating to the `TheSpecial` widget.
* `the-special.html` - HTML import file that will import all the scripts and styles needed to use the element.

If the source file does not follow the pattern `create[custom element]Element`, `@dojo/cli-build-webpack` cannot determine what the name of the custom element should be. In this case, you can specify the `--elementPrefix` option to explicitly name the element.

```bash
dojo build webpack --element=src/path/to/element.ts --elementPrefix=the-special
```

### Feature optimization

This command supports the ability to optimize code based on statically asserted features.  The tool can search the source code for modules that attempt to detect features using a [`@dojo/has`](https://github.com/dojo/has) type of API.  By supplying a feature set (or sets) on the command line, the build will optimize code branches, making the code smaller and more efficient.  This allows targeting of particular platforms.

When specifying multiple feature sets, if they do not align, the tool will not optimize the source code for these feature sets and will instead continue to leave that feature to be detected at run-time.

From the command line, the feature sets are provided to the `-f` or `--feature` argument.  The available feature sets are aligned to platforms.  The currently available feature sets are:

|Feature Set|Description|
|-|-|
|`android`|This feature set represents Android 5+ with integrated Chrome browser.  *Note* it is not suitable for Android 4.4.|
|`chrome`|This feature set represents Chrome 59+ or Opera 46+[<sup>1</sup>](#note-1)|
|`edge`|This feature set represents Edge 15+[<sup>1</sup>](#note-1)|
|`firefox`|This feature set represents Firefox 54+[<sup>1</sup>](#note-1)|
|`ie11`|This feature set represents Internet Explorer 11|
|`ios`|This feature set represents iOS 10.3+[<sup>2</sup>](#note-2)|
|`node`|This feature set represents Node.js 6/7[<sup>2</sup>](#note-2)|
|`node8`|This feature set represents Node.js 8+|
|`safari`|This feature set represents Safari 10+[<sup>2</sup>](#note-2)|

<span id="note-1">[1]:</span> Many of these features were present in earlier versions, but the specific version was the GA release at the time of writing when this was validated.

<span id="note-2">[2]:</span> At least one of the features was not present in previous releases.

Instead of _sniffing_ for a browser, the feature sets are a static set of features that are expressed as flags in the `@dojo` modules.  The current set of flags are:

|Flag|Description|
|-|-|
|arraybuffer|Supports `ArrayBuffer`|
|blob|Supports the `blob` response type for XHR requests|
|dom-mutationobserver|Supports MutationObserver|
|es-observable|Supports ES Observable proposal|
|es2017-object|Supports ES2017 Object features|
|es2017-string|Supports ES2017 String features|
|es6-array|Supports ES2015 Array features (except `.fill`)|
|es6-array-fill|Supports a non-buggy version of `Array.prototype.fill()`|
|es6-map|Supports ES2015 Map|
|es6-math|Supports ES2015 Math features (except `.imul`|
|es6-math-imul|Supports a non-buggy version of `Math.imul()`|
|es6-object|Supports ES2015 Object features|
|es6-promise|Supports ES2015 Promise|
|es6-set|Supports ES2015 Set|
|es6-string|Supports ES2015 String features (except `.raw()`|
|es6-string-raw|Supports a non-buggy version of `String.raw()`|
|es6-symbol|Supports ES2015 Symbol|
|es6-weakmap|Supports ES2015 WeakMap|
|es7-array|Supports ES2016 Array features|
|fetch|Supports the `fetch` API|
|filereader|Supports the FileReader API|
|float32array|Supports the Float32Array API|
|formdata|Supports form data|
|host-node|Is a NodeJS Host|
|host-browser|Is a Browser Host|
|microtasks|Supports an API that allows scheduling of microtasks|
|node-buffer|Supports the Node.JS Buffer API|
|raf|Supports the `requestAnimationFrame` API|
|setimmediate|Supports the `setImmediate` API|
|xhr|Supports XMLHTTPRequest API|
|xhr2|Supports the XMLHTTPRequest 2 API|

An example of generating a build that _hardwires_ features for Microsoft Edge and Chrome, you would use the following on the command line:

```shell
$ dojo build -f edge chrome
```

### Eject

Ejecting `@dojo/cli-build-webpack` will produce a `config/build-webpack/webpack.config.js` file. You can run build using webpack with:

```bash
node_modules/.bin/webpack --config=config/build-webpack/webpack.config.js
```

### Interop with external libraries

External libraries that cannot be loaded normally via webpack can be included in a Dojo 2 application by providing an implementation of `require` or `define`, and some
configuration in the project's `.dojorc` file.
`.dojorc` is a JSON file that contains configuration for Dojo 2 CLI tasks. Configuration for the `dojo build` task can be provided under the
`build-webpack` property.
Configuration for external dependencies can be provided under the `externals` property of the `build-webpack` config. `externals` is an object with two
allowed properties:

* `outputPath`: An optional property specifying an output path to which files should be copied.

* `dependencies`: A required array that defines which modules should be loaded via the external loader, and what files should be included in the build. Each entry can be one of two types:
 * A string that indicates that this path, and any children of this path, should be loaded via the external loader
 * An object that provides additional configuration for dependencies that need to be copied into the built application. This object has the following properties:

 | Property | Type | optional | Description |
 | -------- | ---- | -------- | ----------- |
 | `from` | `string` | `false`  | A path relative to `node_modules` specifying the dependency location to copy into the build application. |
 | `to` | `string` | `true` | A path that replaces `from` as the location to copy this dependency to. By default, dependencies will be copied to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` if `to` is not specified. |
 | `name` | `string` | `true` | Indicates that this path, and any children of this path, should be loaded via the external loader |
 | `inject` | `string, string[], or boolean` | `true` | This property indicates that this dependency defines, or includes, scripts or stylesheets that should be loaded on the page. If `inject` is set to `true`, then the file at the location specified by `to` or `from` will be loaded on the page. If this dependency is a folder, then `inject` can be set to a string or array of strings to define one or more files to inject. Each path in `inject` should be relative to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` depending on whether `to` was provided. |

As an example the following configuration will inject `src/legacy/layer.js` into the application page, declare that modules `a`, `b`, and `c` are external and should be delegated to the external layer, and then copy the folder `node_modules/legacy-dep`, from which several files are injected. All of these files will be copied into the `externals` folder, which could be overridden by specifying the `outputPath` property in the `externals` configuration.
 ```
 "externals": {
    "dependencies": [
        "a",
        "b",
        "c",
        { "from": "src/legacy/layer.js", "inject": true },
        { "from": "node_modules/legacy-dep", "inject": [ "modulA/layer.js", "moduleA/layer.css", "moduleB/layer.js" ] }
    ]
 }
```

Types for any dependencies included in `externals` can be installed in `node_modules/@types`, like any other dependency.

## How do I contribute?

We appreciate your interest!  Please see the [Dojo 2 Meta Repository](https://github.com/dojo/meta#readme) for the
Contributing Guidelines and Style Guide.

### Installation

To start working with this package, clone the repository and run `npm install`.

In order to build the project run `grunt dev` or `grunt dist`.

### Testing

Test cases MUST be written using [Intern](https://theintern.github.io) using the Object test interface and Assert assertion interface.

90% branch coverage MUST be provided for all code submitted to this repository, as reported by istanbul’s combined coverage results for all supported platforms.

To test locally in node run:

`grunt test`

## Licensing information

© 2017 [JS Foundation](https://js.foundation/). [New BSD](http://opensource.org/licenses/BSD-3-Clause) license.
