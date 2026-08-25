import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import Sink from "../lib/main.js";

const RE_ILLEGAL_FILE_PATH = /Argument must be a String/;
const RE_ILLEGAL_CONTENT_TYPE = /Argument must be a String/;
const RE_DIRECTORY_TRAVERSAL = /Directory traversal/;
const RE_DOES_NOT_EXIST = /does not exist/;

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

test("Sink() - .writeBuffer() - should write a buffer and allow reading it back", async () => {
	const sink = new Sink();
	await sink.writeBuffer(
		"/buf/data.json",
		"application/json",
		Buffer.from('{"ok":true}'),
	);
	const result = await sink.readBuffer("/buf/data.json");
	assert.ok(Buffer.isBuffer(result), "should return a Buffer");
	assert.strictEqual(result.toString(), '{"ok":true}');
});

test("Sink() - .writeBuffer() - arguments is illegal", async () => {
	const sink = new Sink();
	await assert.rejects(
		// @ts-ignore
		sink.writeBuffer(300, "application/json", Buffer.from("x")),
		RE_ILLEGAL_FILE_PATH,
	);
	await assert.rejects(
		// @ts-ignore
		sink.writeBuffer("/valid/path.js", 300, Buffer.from("x")),
		RE_ILLEGAL_CONTENT_TYPE,
	);
});

test("Sink() - .writeBuffer() - directory traversal prevention", async () => {
	const sink = new Sink({ rootPath: "/eik" });
	await assert.rejects(
		sink.writeBuffer(
			"../../sensitive.data",
			"application/octet-stream",
			Buffer.from("x"),
		),
		RE_DIRECTORY_TRAVERSAL,
	);
});

test("Sink() - .readBuffer() - file does not exist", async () => {
	const sink = new Sink();
	await assert.rejects(sink.readBuffer("/missing/file.js"), RE_DOES_NOT_EXIST);
});
