import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { ReadFile } from "@eik/common";
import Sink from "@eik/sink";
import MetricsClient from "@metrics/client";
import Entry from "./entry.js";

/**
 * @typedef {object} SinkMemoryOptions
 * @property {string} [rootPath="/"]
 */

export default class SinkMemory extends Sink {
	_metrics = new MetricsClient();
	/** @type {Map<string, Entry>}*/
	_state = new Map();

	/**
	 *
	 * @param {SinkMemoryOptions} options
	 */
	constructor(options = {}) {
		super();
		this._rootPath = options.rootPath || "/";
		this._counter = this._metrics.counter({
			name: "eik_core_sink_mem",
			description: "Counter measuring access to the in memory storage sink",
			labels: {
				operation: "n/a",
				success: false,
				access: false,
			},
		});
	}

	get metrics() {
		return this._metrics;
	}

	/**
	 * @param {string} filePath
	 * @param {string} contentType
	 * @returns {Promise<Writable>}
	 */
	write(filePath, contentType) {
		return new Promise((resolve, reject) => {
			const operation = "write";

			try {
				Sink.validateFilePath(filePath);
				Sink.validateContentType(contentType);
			} catch (error) {
				this._counter.inc({ labels: { operation } });
				reject(error);
				return;
			}

			const pathname = join(this._rootPath, filePath).replace(/\\/g, "/");

			if (pathname.indexOf(this._rootPath) !== 0) {
				reject(new Error(`Directory traversal - ${filePath}`));
				this._counter.inc({ labels: { operation } });
				return;
			}

			const payload = [];
			const stream = new Writable({
				write(chunk, encoding, cb) {
					payload.push(chunk);
					cb();
				},
			});

			stream.on("finish", () => {
				const entry = new Entry({
					mimeType: contentType,
					payload,
				});

				this._state.set(pathname, entry);

				this._counter.inc({
					labels: {
						success: true,
						access: true,
						operation,
					},
				});
			});

			resolve(stream);
		});
	}

	/**
	 * @param {string} filePath
	 * @throws {Error} if the file does not exist
	 * @returns {Promise<import('@eik/common').ReadFile>}
	 */
	read(filePath) {
		return new Promise((resolve, reject) => {
			const operation = "read";

			try {
				Sink.validateFilePath(filePath);
			} catch (error) {
				this._counter.inc({ labels: { operation } });
				reject(error);
				return;
			}

			const pathname = join(this._rootPath, filePath).replace(/\\/g, "/");

			if (pathname.indexOf(this._rootPath) !== 0) {
				this._counter.inc({ labels: { operation } });
				reject(new Error(`Directory traversal - ${filePath}`));
				return;
			}

			const entry = this._state.get(pathname);
			if (!entry) {
				reject(new Error(`${filePath} does not exist`));
			}

			const payload = entry.payload || [];
			const obj = new ReadFile({
				mimeType: entry.mimeType,
				etag: entry.hash,
			});

			obj.stream = new Readable({
				read() {
					payload.forEach((item) => {
						this.push(item);
					});
					this.push(null);
				},
			});

			obj.stream.on("end", () => {
				this._counter.inc({
					labels: {
						success: true,
						access: true,
						operation,
					},
				});
			});

			resolve(obj);
		});
	}

	/**
	 * @param {string} filePath
	 * @throws {Error} if the file does not exist
	 * @returns {Promise<void>}
	 */
	delete(filePath) {
		return new Promise((resolve, reject) => {
			const operation = "delete";

			try {
				Sink.validateFilePath(filePath);
			} catch (error) {
				this._counter.inc({ labels: { operation } });
				reject(error);
				return;
			}

			const pathname = join(this._rootPath, filePath).replace(/\\/g, "/");

			if (pathname.indexOf(this._rootPath) !== 0) {
				this._counter.inc({ labels: { operation } });
				reject(new Error(`Directory traversal - ${filePath}`));
				return;
			}

			// Delete recursively
			Array.from(this._state.keys()).forEach((key) => {
				if (key.startsWith(pathname)) {
					this._state.delete(key);
				}
			});

			this._counter.inc({
				labels: {
					success: true,
					access: true,
					operation,
				},
			});

			resolve();
		});
	}

	/**
	 * @param {string} filePath
	 * @throws {Error} if the file does not exist
	 * @returns {Promise<void>}
	 */
	exist(filePath) {
		return new Promise((resolve, reject) => {
			const operation = "exist";

			try {
				Sink.validateFilePath(filePath);
			} catch (error) {
				this._counter.inc({ labels: { operation } });
				reject(error);
				return;
			}

			const pathname = join(this._rootPath, filePath).replace(/\\/g, "/");

			if (pathname.indexOf(this._rootPath) !== 0) {
				this._counter.inc({ labels: { operation } });
				reject(new Error(`Directory traversal - ${filePath}`));
				return;
			}

			this._counter.inc({
				labels: {
					success: true,
					access: true,
					operation,
				},
			});

			if (this._state.has(pathname)) {
				resolve();
				return;
			}

			reject(new Error(`${filePath} does not exist`));
		});
	}
}
