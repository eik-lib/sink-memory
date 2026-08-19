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

// Regression tests for write() options and read() generation

test("Sink() - .write() - ifNotExists rejects when file already exists", async () => {
	const sink = new Sink();
	const path = "/mem/foo/bar.txt";
	const w1 = await sink.write(path, "text/plain");
	await pipeline(Readable.from(["first"]), w1);

	// Second write without option succeeds (overwrite) — current behaviour.
	// With ifNotExists, it must reject.
	await assert.rejects(
		sink.write(path, "text/plain", { ifNotExists: true }),
		(/** @type {any} */ err) => {
			assert.strictEqual(err.code, "ALREADY_EXISTS");
			return true;
		},
		"should reject with ALREADY_EXISTS when file already exists",
	);
});

test("Sink() - .write() - ifNotExists succeeds when file does not exist", async () => {
	const sink = new Sink();
	const path = "/mem/foo/new.txt";

	const w = await sink.write(path, "text/plain", { ifNotExists: true });
	await assert.doesNotReject(
		pipeline(Readable.from(["content"]), w),
		"should succeed when file does not yet exist",
	);
	await assert.doesNotReject(sink.exist(path));
});

test("Sink() - .read() - returns a generation token", async () => {
	const sink = new Sink();
	const path = "/mem/foo/versioned.txt";
	const w = await sink.write(path, "text/plain");
	await pipeline(Readable.from(["v1"]), w);

	const file = await sink.read(path);
	assert.ok(
		file.generation !== undefined && file.generation !== "",
		"read() should return a non-empty generation token",
	);
});

test("Sink() - .write() - ifGenerationMatch rejects when generation does not match", async () => {
	const sink = new Sink();
	const path = "/mem/foo/cas.txt";
	const w1 = await sink.write(path, "text/plain");
	await pipeline(Readable.from(["v1"]), w1);

	await assert.rejects(
		sink.write(path, "text/plain", { ifGenerationMatch: "wrong-generation" }),
		(/** @type {any} */ err) => {
			assert.strictEqual(err.code, "CONFLICT");
			return true;
		},
		"should reject with CONFLICT when generation does not match",
	);
});

test("Sink() - .write() - ifGenerationMatch succeeds when generation matches", async () => {
	const sink = new Sink();
	const path = "/mem/foo/cas2.txt";
	const w1 = await sink.write(path, "text/plain");
	await pipeline(Readable.from(["v1"]), w1);

	const file = await sink.read(path);
	const generation = file.generation;

	const w2 = await sink.write(path, "text/plain", {
		ifGenerationMatch: generation,
	});
	await assert.doesNotReject(
		pipeline(Readable.from(["v2"]), w2),
		"should succeed when generation matches",
	);
});
