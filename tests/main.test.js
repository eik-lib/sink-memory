import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tap from 'tap';
import Sink from '../lib/main.js';

tap.test('Sink() - Object type', (t) => {
    const sink = new Sink();
    const name = Object.prototype.toString.call(sink);
    t.ok(name.startsWith('[object Sink'), 'should begin with Sink');
    t.end();
});

tap.test('Sink() - .write()', async (t) => {
    const sink = new Sink();
    const writable = await sink.write('/mem/foo/bar.txt', 'text/plain');
    const readable = Readable.from(['Hello, World!']);
    t.resolves(pipeline(readable, writable));
    t.end();
});

tap.test('Sink() - .read() - File exists', async (t) => {
    const sink = new Sink();

    const path = '/mem/foo/bar.txt';
    const type = 'text/plain';
    const writable = await sink.write(path, type);
    const readable = Readable.from(['Hello, World!']);
    t.resolves(pipeline(readable, writable));

    const file = await sink.read(path);
    t.equal(file.mimeType, type);
    t.ok(file.stream);

    const chunks = [];
    for await (const chunk of file.stream) {
        chunks.push(Buffer.from(chunk));
    }

    t.equal(Buffer.concat(chunks).toString('utf-8'), 'Hello, World!');
    t.end();
});

tap.test('Sink() - .read() - File does not exist', (t) => {
    const sink = new Sink();
    t.rejects(sink.read('/does/not/exist.txt'));
    t.end();
});

tap.test('Sink() - .delete() - File exists', async (t) => {
    const sink = new Sink();
    const path = '/mem/foo/bar.txt';
    const writable = await sink.write(path, 'text/plain');
    const readable = Readable.from(['Hello, World!']);

    t.resolves(pipeline(readable, writable));
    t.resolves(sink.delete(path));

    t.rejects(
        sink.delete(path),
        'Second call to delete should reject if file is successfully deleted',
    );

    t.end();
});

tap.test('Sink() - .delete() - File does not exist', (t) => {
    const sink = new Sink();
    t.rejects(sink.delete('/does/not/exist.txt'));
    t.end();
});

tap.test('Sink() - .exist() - File exists', async (t) => {
    const sink = new Sink();
    const path = '/mem/foo/bar.txt';
    const writable = await sink.write(path, 'text/plain');
    const readable = Readable.from(['Hello, World!']);

    t.resolves(pipeline(readable, writable));
    t.resolves(sink.exist(path));
    t.end();
});

tap.test('Sink() - .exist() - File does not exist', (t) => {
    const sink = new Sink();
    t.rejects(sink.exist('/does/not/exist.txt'));
    t.end();
});
