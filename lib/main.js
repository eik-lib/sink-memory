import { ReadFile } from '@eik/common';
import Sink from '@eik/sink';
import { Readable, Writable } from 'node:stream';

/** @type {Map<string, string>} */
let content = new Map();
/** @type {Map<string, string>} */
let mimetypes = new Map();

export default class SinkMemory extends Sink {
    /**
     * @param {string} filePath
     * @param {string} contentType
     * @returns {Promise<Writable>}
     */
    write(filePath, contentType) {
        return new Promise((resolve, reject) => {
            try {
                Sink.validateFilePath(filePath);
                Sink.validateContentType(contentType);
            } catch (error) {
                reject(error);
                return;
            }

            if (!content.has(filePath)) {
                content.set(filePath, '');
                mimetypes.set(filePath, contentType);
            }

            resolve(
                new Writable({
                    write(chunk, encoding, callback) {
                        try {
                            content.set(
                                filePath,
                                content.get(filePath) + chunk.toString(),
                            );
                            callback();
                        } catch (e) {
                            callback(e);
                        }
                    },
                }),
            );
        });
    }

    /**
     * @param {string} filePath
     * @throws {Error} if the file does not exist
     * @returns {Promise<import('@eik/common').ReadFile>}
     */
    read(filePath) {
        return new Promise((resolve, reject) => {
            try {
                Sink.validateFilePath(filePath);
            } catch (error) {
                reject(error);
                return;
            }

            if (!content.has(filePath)) {
                reject(new Error(`${filePath} does not exist`));
            }

            let stream = new Readable({
                read() {
                    this.push(content.get(filePath));
                    this.push(null);
                },
            });

            const file = new ReadFile({
                mimeType: mimetypes.get(filePath),
            });
            file.stream = stream;

            resolve(file);
        });
    }

    /**
     * @param {string} filePath
     * @throws {Error} if the file does not exist
     * @returns {Promise<void>}
     */
    delete(filePath) {
        return new Promise((resolve, reject) => {
            try {
                Sink.validateFilePath(filePath);
            } catch (error) {
                reject(error);
                return;
            }

            if (!content.has(filePath)) {
                reject(new Error(`${filePath} does not exist`));
            }

            content.delete(filePath);

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
            try {
                Sink.validateFilePath(filePath);
            } catch (error) {
                reject(error);
                return;
            }

            if (!content.has(filePath)) {
                reject(new Error(`${filePath} does not exist`));
            }

            resolve();
        });
    }
}
