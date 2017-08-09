import Compiler = require('webpack/lib/Compiler');

// TODO: See https://github.com/webpack/watchpack/issues/51
// The first time webpack's file watcher comes across a new file, it adds 10s to its mtime,
// and then emits change events until the compilation start time passes that mtime. The result
// of this behavior is that when initially running `$ dojo build -w`, the app compiles multiple
// times. This plugin works by removing the 10s buffer added to the file's mtime with the
// initial pass.
const FS_ACCURACY = 10000;

export class IgnoreUnmodifiedPlugin {
	apply(compiler: Compiler) {
		compiler.plugin('after-environment', () => {
			const wfs = compiler.watchFileSystem.wfs || compiler.watchFileSystem;
			const mtimes: { [filePath: string]: number } = Object.create(null);
			let watcher: any;

			Object.defineProperty(wfs, 'watcher', {
				get() {
					return watcher;
				},
				set(_watcher) {
					watcher = _watcher;
					const onChange = watcher._onChange;
					watcher._onChange = function (item: string, mtime: number) {
						if (!(item in mtimes) || mtimes[item] !== mtime) {
							mtimes[item] = mtime - FS_ACCURACY;
							return onChange.apply(watcher, arguments);
						}

						delete mtimes[item];
						watcher._onChange = onChange;
					};
				}
			});
		});
	}
}

export default IgnoreUnmodifiedPlugin;
