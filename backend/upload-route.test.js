const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('./server');

const localDataFile = path.join(__dirname, 'uploaded-data.json');

function postToUpload(path, payload = [{ id: 1, primary: '#000000', background: '#FFFFFF', text_color: '#000000' }]) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method: 'POST',
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

      req.write(JSON.stringify(payload));
      req.end();
    });
  });
}

test('upload endpoint accepts encoded trailing-space paths', async () => {
  const result = await postToUpload('/upload%20');
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /uploaded successfully|Data uploaded successfully/i);
});

test('upload endpoint appends new rows and returns cumulative count', async () => {
  const original = fs.existsSync(localDataFile)
    ? fs.readFileSync(localDataFile, 'utf8')
    : null;

  const firstBatch = Array.from({ length: 200 }, (_, index) => ({
    id: index + 1,
    primary: '#000000',
    background: '#FFFFFF',
    text_color: '#000000'
  }));
  const secondBatch = [{ id: 201, primary: '#111111', background: '#FFFFFF', text_color: '#000000' }];

  try {
    const firstResult = await postToUpload('/upload', firstBatch);
    assert.equal(firstResult.statusCode, 200);
    assert.equal(JSON.parse(firstResult.body).count, 200);

    const secondResult = await postToUpload('/upload', secondBatch);
    assert.equal(secondResult.statusCode, 200);

    const parsed = JSON.parse(secondResult.body);
    assert.equal(parsed.uploadedCount, 1);
    assert.equal(parsed.count, 201);

    const written = JSON.parse(fs.readFileSync(localDataFile, 'utf8'));
    assert.equal(written.length, 201);
    assert.equal(written[200].id, 201);
  } finally {
    if (original === null) {
      if (fs.existsSync(localDataFile)) fs.unlinkSync(localDataFile);
    } else {
      fs.writeFileSync(localDataFile, original, 'utf8');
    }
  }
});
