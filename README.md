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
  - [Eject](#eject)
  - [3rd party library integration](#interop-with-external-libraries)
- [How to I contribute?](#how-do-i-contribute)
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
Configuration for external dependencies can be provided under the `externals` property of the `build-webpack` config.

`externals` is an object, with two allowed properties.

 `outputPath`: An optional property specifying an output path to which files should be copied.

 `dependencies`: A required array that defines which modules should be loaded via the external loader, and what files should be included in the build. Each entry can be one of two types:
* A string. In this case the entry simply indicates that this path, and any children of this path, should be loaded via the external loader
* An object that provides additional configuration for dependencies that need to be copied into the built application. This object has the following properties:

 | Property | Type | optional | Description |
 | -------- | ---- | -------- | ----------- |
 | `from` | `string` | `false`  | A path relative to `node_modules` specifying the dependency location to copy into the build application. |
 | `to` | `string` | `true` | A path that replaces `from` as the location to copy this dependency to. By default, dependencies will be copied to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` if `to` is not specified. |
 | `name` | `string` | `true` | Indicates that this path, and any children of this path, should be loaded via the external loader |
 | `inject` | `string, string[], or boolean` | `true` | This property indicates that this dependency defines, or includes, scripts or stylesheets that should be loaded on the page. If `inject` is set to `true`, then the file at the location specified by `to` or `from` will be loaded on the page. If this dependency is a folder, then `inject` can be set to a string or array of strings to define one or more files to inject. Each path in `inject` should be relative to `${externalsOutputPath}/${to}` or `${externalsOutputPath}/${from}` depending on whether `to` was provided. |

 As an example the following configuration will inject `src/legacy/layer.js` into the application page, declare that modules `a`, `b`, and `c` are external
 and should be delegated to the external layer, and then copy the folder `node_modules/legacy-dep`, from which several files are injected. All of these files will be copied into the `externals` folder, which could be overridden by specifying the `outputPath` property in the `externals` configuration.
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
