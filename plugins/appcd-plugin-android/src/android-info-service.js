import DetectEngine from 'appcd-detect';
import gawk from 'gawk';
import path from 'path';

import * as androidlib from 'androidlib';

import { bat, cmd, exe } from 'appcd-subprocess';
import { DataServiceDispatcher } from 'appcd-dispatcher';
import { get, mergeDeep } from 'appcd-util';

/**
 * The Android info service.
 */
export default class AndroidInfoService extends DataServiceDispatcher {
	/**
	 * Starts detecting Android information.
	 *
	 * @param {Config} cfg - An Appc Daemon config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(cfg) {
		this.config = cfg;

		this.data = gawk({
			devices: [],
			emulators: [],
			ndk: [],
			sdk: []
		});

		/**
		 * A map of buckets to a list of active fs watch subscription ids.
		 * @type {Object}
		 */
		this.subscriptions = {};

		if (cfg.android) {
			mergeDeep(androidlib.options, cfg.android);
		}

		await this.initDevices();
		await this.initEmulators();
		await this.initNDKs();
		await this.initSDKs();
	}

	/**
	 * Initializes device tracking.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initDevices() {
		this.trackDeviceHandle = await androidlib.devices
			.trackDevices()
			.on('devices', devices => {
				console.log('Devices changed');
				gawk.set(this.data.devices, devices);
			})
			.on('error', err => {
				console.log('Track devices returned error: %s', err.message);
			});
	}

	/**
	 * Initializes the fs watcher Android emulators and starts the initial scan.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initEmulators() {
		const emulators = await androidlib.emulators.getEmulators(null, true);
		gawk.set(this.data.emulators, emulators);

		this.watch({
			type: 'avd',
			depth: 1,
			paths: [ androidlib.emulators.getAvdDir() ],
			handler: async () => {
				console.log('Rescanning Android emulators...');
				const emulators = await androidlib.emulators.getEmulators(null, true);
				gawk.set(this.data.emulators, emulators);
			}
		});
	}

	/**
	 * Wires up the Android NDK detect engine.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initNDKs() {
		this.ndkDetectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new androidlib.ndk.NDK(dir);
				} catch (e) {
					// 'dir' is not an NDK
				}
			},
			depth:     1,
			env:       'ANDROID_NDK',
			exe:       `ndk-build${cmd}`,
			multiple:  true,
			paths:     androidlib.ndk.ndkLocations[process.platform],
			processResults: async (results, engine) => {
				// TODO: sort results
				// TODO: assign default ndk
			},
			recursive: true,
			redetect:  true,
			watch:     true
		});

		// listen for ndk results
		this.ndkDetectEngine.on('results', results => {
			gawk.set(this.data.ndk, results);
		});

		await this.ndkDetectEngine.start();
	}

	/**
	 * Wires up the Android SDK detect engine.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async initSDKs() {
		const paths = [ ...androidlib.sdk.sdkLocations[process.platform] ];
		const defaultPath = get(this.config, 'android.sdkPath');
		if (defaultPath) {
			paths.unshift(defaultPath);
		}

		this.sdkDetectEngine = new DetectEngine({
			checkDir(dir) {
				try {
					return new androidlib.sdk.SDK(dir);
				} catch (e) {
					// 'dir' is not an SDK
				}
			},
			depth: 1,
			env: [ 'ANDROID_SDK', 'ANDROID_SDK_ROOT' ],
			exe: [ `adb${exe}`, `android${bat}` ],
			multiple: true,
			paths,
			processResults: async (results, engine) => {
				// TODO: sort results
				// TODO: assign default sdk
			},
			recursive: true,
			registryKeys: [
				{
					hive: 'HKLM',
					key: 'SOFTWARE\\Wow6432Node\\Android SDK Tools',
					name: 'Path'
				},
				{
					hive: 'HKLM',
					key: 'SOFTWARE\\Android Studio',
					name: 'SdkPath'
				}
			],
			redetect: true,
			watch: true
		});

		// listen for sdk results
		this.sdkDetectEngine.on('results', results => {
			gawk.set(this.data.sdk, results);
		});

		// if sdks change, then refresh the emulators
		gawk.watch(this.data.sdk, async (obj, src) => {
			// TODO: redetect emulators if the default sdk changed
			// console.log('SDKs changed');
			// console.log(src);
		});

		// detect the sdks which in turn will detect the emulators
		await this.sdkDetectEngine.start();
	}

	/**
	 * Subscribes to filesystem events for the specified paths.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String} params.type - The type of subscription.
	 * @param {Array.<String>} params.paths - One or more paths to watch.
	 * @param {Function} params.handler - A callback function to fire when a fs event occurs.
	 * @param {Number} [params.depth] - The max depth to recursively watch.
	 * @access private
	 */
	watch({ type, paths, handler, depth }) {
		for (const path of paths) {
			const data = { path };
			if (depth) {
				data.recursive = true;
				data.depth = 1;
			}

			appcd
				.call('/appcd/fswatch', {
					data,
					type: 'subscribe'
				})
				.then(ctx => {
					let sid;
					ctx.response
						.on('data', async (data) => {
							if (data.type === 'subscribe') {
								sid = data.sid;
								if (!this.subscriptions[type]) {
									this.subscriptions[type] = {};
								}
								this.subscriptions[type][data.sid] = 1;
							} else if (data.type === 'event') {
								handler(data.message);
							}
						})
						.on('end', () => {
							if (sid) {
								delete this.subscriptions[type][sid];
							}
						});
				});
		}
	}

	/**
	 * Unsubscribes a list of filesystem watcher subscription ids.
	 *
	 * @param {Number} type - The type of subscription.
	 * @param {Array.<String>} [sids] - An array of subscription ids to unsubscribe. If not
	 * specified, defaults to all sids for the specified types.
	 * @returns {Promise}
	 * @access private
	 */
	async unwatch(type, sids) {
		if (!sids) {
			sids = Object.keys(this.subscriptions[type]);
		}

		for (const sid of sids) {
			await appcd.call('/appcd/fswatch', {
				sid,
				type: 'unsubscribe'
			});

			delete this.subscriptions[type][sid];
		}

		if (!Object.keys(this.subscriptions[type])) {
			delete this.subscriptions[type];
		}
	}

	/**
	 * Stops the detect engines.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		if (this.sdkDetectEngine) {
			await this.sdkDetectEngine.stop();
			this.sdkDetectEngine = null;
		}

		if (this.ndkDetectEngine) {
			await this.ndkDetectEngine.stop();
			this.ndkDetectEngine = null;
		}

		if (this.avdDetectEngine) {
			await this.avdDetectEngine.stop();
			this.avdDetectEngine = null;
		}

		if (this.subscriptions) {
			for (const type of Object.keys(this.subscriptions)) {
				await this.unwatch(type);
			}
		}
	}
}