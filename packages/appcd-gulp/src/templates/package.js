'use strict';

module.exports = (opts) => {
	require('./standard')(opts);

	const {
		exports,
		projectDir
	} = opts;

	const babelConf   = require('../babel')(opts);
	const fs          = require('fs-extra');
	const gulp        = require('gulp');
	const path        = require('path');
	const webpack     = require('webpack');

	const packageName = opts.pkgJson.name;
	const outDir      = path.join(projectDir, 'out');

	const { parallel, series } = gulp;

	exports['clean-package'] = () => fs.remove(outDir);

	exports.package = series(
		parallel(exports['clean-package'], exports.build),
		async function pkg() {
			const compiler = webpack({
				context: projectDir,
				entry: path.resolve(projectDir, opts.pkgJson.main || 'index.js'),
				module: {
					rules: [
						{
							test: /\.js$/,
							exclude: /node_modules/,
							use: {
								loader: 'babel-loader',
								options: babelConf
							}
						}
					]
				},
				node: {
					__dirname: true,
					__filename: true
				},
				optimization: {
					minimize: false
				},
				output: {
					filename: `${packageName}.js`,
					// filename: packageName,
					path: outDir
				},
				plugins: [
					// new webpack.BannerPlugin({
					// 	banner: '#!/usr/bin/env node',
					// 	include: new RegExp(opts.pkgJson.name),
					// 	raw: true
					// })
				],
				target: 'node'
			});

			return new Promise(resolve => {
				compiler.run((err, stats) => {
					if (err) {
						console.error(err);
						return resolve();
					}

					if (stats.hasErrors()) {
						let i = 0;
						for (const err of stats.compilation.errors) {
							i++ || console.error();
							console.error(err);
						}
						return resolve();
					}

					for (const file of stats.compilation.fileDependencies) {
						console.log(file);
					}

					resolve();
				});
			});
		}
	);
};
