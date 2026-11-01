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

test('delete endpoint removes one row by id', async () => {
  const original = fs.existsSync(localDataFile)
    ? fs.readFileSync(localDataFile, 'utf8')
    : null;

  const seed = [
    { id: 701, primary: '#111111' },
    { id: 702, primary: '#222222' },
    { id: 703, primary: '#333333' }
  ];

  fs.writeFileSync(localDataFile, JSON.stringify(seed, null, 2), 'utf8');

  try {
    const result = await withServerRequest('DELETE', '/delete/702');
    assert.equal(result.statusCode, 200);

    const parsed = JSON.parse(result.body);
    assert.equal(parsed.data.id, 702);

    const written = JSON.parse(fs.readFileSync(localDataFile, 'utf8'));
    assert.equal(written.length, 2);
    assert.equal(written.some((row) => row.id === 702), false);
  } finally {
    if (original === null) {
      if (fs.existsSync(localDataFile)) fs.unlinkSync(localDataFile);
    } else {
      fs.writeFileSync(localDataFile, original, 'utf8');
    }
  }
});

test('delete endpoint returns 404 when id is not found', async () => {
  const original = fs.existsSync(localDataFile)
    ? fs.readFileSync(localDataFile, 'utf8')
    : null;

  const seed = [{ id: 801, primary: '#121212' }];
  fs.writeFileSync(localDataFile, JSON.stringify(seed, null, 2), 'utf8');

  try {
    const result = await withServerRequest('DELETE', '/delete/9999');
    assert.equal(result.statusCode, 404);
  } finally {
    if (original === null) {
      if (fs.existsSync(localDataFile)) fs.unlinkSync(localDataFile);
    } else {
      fs.writeFileSync(localDataFile, original, 'utf8');
    }
  }
});

test('delete all endpoint removes all rows', async () => {
  const original = fs.existsSync(localDataFile)
    ? fs.readFileSync(localDataFile, 'utf8')
    : null;

  const seed = [
    { id: 901, primary: '#AAAAAA' },
    { id: 902, primary: '#BBBBBB' }
  ];
  fs.writeFileSync(localDataFile, JSON.stringify(seed, null, 2), 'utf8');

  try {
    const result = await withServerRequest('DELETE', '/delete/all');
    assert.equal(result.statusCode, 200);

    const written = JSON.parse(fs.readFileSync(localDataFile, 'utf8'));
    assert.deepEqual(written, []);
  } finally {
    if (original === null) {
      if (fs.existsSync(localDataFile)) fs.unlinkSync(localDataFile);
    } else {
      fs.writeFileSync(localDataFile, original, 'utf8');
    }
  }
});
