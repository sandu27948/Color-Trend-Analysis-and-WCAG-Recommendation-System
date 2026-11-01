const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('./server');

const localDataFile = path.join(__dirname, 'uploaded-data.json');

function withServerRequest(method, requestPath, payload) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: requestPath,
          method,
          headers: { 'content-type': 'application/json' }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            server.close(() => resolve({ statusCode: res.statusCode, body: data }));
          });
        }
      );

      req.on('error', (error) => {
        server.close(() => reject(error));
      });

      if (payload !== undefined) {
        req.write(JSON.stringify(payload));
      }
      req.end();
    });
  });
}

function readJson(body) {
  return JSON.parse(body);
}

test('update endpoint merges array payload by id and preserves existing rows', async () => {
  const original = fs.existsSync(localDataFile)
    ? fs.readFileSync(localDataFile, 'utf8')
    : null;

  const seed = [
    { id: 1001, primary: '#101010', background: '#FFFFFF', text_color: '#111111' },
    { id: 1002, primary: '#202020', background: '#FAFAFA', text_color: '#202020' }
  ];
  const incoming = [
    { id: 1002, primary: '#ABABAB' },
    { id: 1003, primary: '#303030', background: '#F0F0F0', text_color: '#222222' }
  ];

  try {
    fs.writeFileSync(localDataFile, JSON.stringify(seed, null, 2), 'utf8');

    const result = await withServerRequest('PUT', '/update', incoming);
    assert.equal(result.statusCode, 200);
    assert.match(result.body, /updated successfully|Data updated successfully/i);

    const written = JSON.parse(fs.readFileSync(localDataFile, 'utf8'));
    assert.equal(written.length, 3);
    assert.equal(written[0].id, 1001);
    assert.equal(written[1].id, 1002);
    assert.equal(written[1].primary, '#ABABAB');
    assert.equal(written[2].id, 1003);

    const dataResult = await withServerRequest('GET', '/data');
    assert.equal(dataResult.statusCode, 200);

    const payload = readJson(dataResult.body);
    assert.equal(payload.length, 3);
  } finally {
    if (original === null) {
      if (fs.existsSync(localDataFile)) fs.unlinkSync(localDataFile);
    } else {
      fs.writeFileSync(localDataFile, original, 'utf8');
    }
  }
});

test('update endpoint updates one row when object payload with id is provided', async () => {
  const original = fs.existsSync(localDataFile)
    ? fs.readFileSync(localDataFile, 'utf8')
    : null;

  const seed = [
    { id: 501, primary: '#123456', background: '#FFFFFF', text_color: '#000000' },
    { id: 502, primary: '#654321', background: '#000000', text_color: '#FFFFFF' }
  ];

  fs.writeFileSync(localDataFile, JSON.stringify(seed, null, 2), 'utf8');

  try {
    const result = await withServerRequest('PUT', '/update', { id: 501, primary: '#ABCDEF' });
    assert.equal(result.statusCode, 200);

    const parsedBody = JSON.parse(result.body);
    assert.equal(parsedBody.data.id, 501);
    assert.equal(parsedBody.data.primary, '#ABCDEF');
    assert.equal(parsedBody.count, 2);

    const written = JSON.parse(fs.readFileSync(localDataFile, 'utf8'));
    assert.equal(written[0].id, 501);
    assert.equal(written[0].primary, '#ABCDEF');
    assert.equal(written[1].primary, '#654321');

    const dataResult = await withServerRequest('GET', '/data');
    assert.equal(dataResult.statusCode, 200);

    const payload = readJson(dataResult.body);
    assert.equal(payload.length, 2);
    assert.equal(payload[0].primary, '#ABCDEF');
  } finally {
    if (original === null) {
      if (fs.existsSync(localDataFile)) fs.unlinkSync(localDataFile);
    } else {
      fs.writeFileSync(localDataFile, original, 'utf8');
    }
  }
});

test('update endpoint replaces dataset only when replaceAll is true', async () => {
  const original = fs.existsSync(localDataFile)
    ? fs.readFileSync(localDataFile, 'utf8')
    : null;

  const seed = [
    { id: 1, primary: '#111111' },
    { id: 2, primary: '#222222' }
  ];
  const replacement = [
    { id: 201, primary: '#ABC123' }
  ];

  try {
    fs.writeFileSync(localDataFile, JSON.stringify(seed, null, 2), 'utf8');

    const result = await withServerRequest('PUT', '/update', {
      replaceAll: true,
      data: replacement
    });

    assert.equal(result.statusCode, 200);

    const parsed = readJson(result.body);
    assert.equal(parsed.mode, 'replace');
    assert.equal(parsed.count, 1);

    const written = JSON.parse(fs.readFileSync(localDataFile, 'utf8'));
    assert.deepEqual(written, replacement);
  } finally {
    if (original === null) {
      if (fs.existsSync(localDataFile)) fs.unlinkSync(localDataFile);
    } else {
      fs.writeFileSync(localDataFile, original, 'utf8');
    }
  }
});

test('update endpoint returns 400 when body is invalid', async () => {
  const result = await withServerRequest('PUT', '/update', {});
  assert.equal(result.statusCode, 400);
});
