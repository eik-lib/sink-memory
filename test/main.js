import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import Sink from "../lib/main.js";

test("Sink() - Object type", () => {
	const sink = new Sink();
	const name = Object.prototype.toString.call(sink);
	assert.ok(name.startsWith("[object Sink"), "should begin with Sink");
});

test("Sink() - .write()", async () => {
	const sink = new Sink();
	const writable = await sink.write("/mem/foo/bar.txt", "text/plain");
	const readable = Readable.from(["Hello, World!"]);
	await assert.doesNotReject(pipeline(readable, writable));
});

test("Sink() - .read() - File exists", async () => {
	const sink = new Sink();

	const path = "/mem/foo/bar.txt";
	const type = "text/plain";
	const writable = await sink.write(path, type);
	const readable = Readable.from(["Hello, World!"]);
	await assert.doesNotReject(pipeline(readable, writable));

	const file = await sink.read(path);
	assert.strictEqual(file.mimeType, type);
	assert.ok(file.stream);

	const chunks = [];
	for await (const chunk of file.stream) {
		chunks.push(Buffer.from(chunk));
	}

	assert.strictEqual(Buffer.concat(chunks).toString("utf-8"), "Hello, World!");
});

test("Sink() - .read() - File does not exist", async () => {
	const sink = new Sink();
	await assert.rejects(sink.read("/does/not/exist.txt"));
});

test("Sink() - .delete()", async () => {
	const sink = new Sink();
	const path = "/mem/foo/bar.txt";
	const writable = await sink.write(path, "text/plain");
	const readable = Readable.from(["Hello, World!"]);

	await assert.doesNotReject(pipeline(readable, writable));
	await assert.doesNotReject(sink.delete(path));
});

test("Sink() - .exist() - File exists", async () => {
	const sink = new Sink();
	const path = "/mem/foo/bar.txt";
	const writable = await sink.write(path, "text/plain");
	const readable = Readable.from(["Hello, World!"]);

	await assert.doesNotReject(pipeline(readable, writable));
	await assert.doesNotReject(sink.exist(path));
});

test("Sink() - .exist() - File does not exist", async () => {
	const sink = new Sink();
	await assert.rejects(sink.exist("/does/not/exist.txt"));
});
