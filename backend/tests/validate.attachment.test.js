const express = require('express');
const request = require('supertest');
const { chatRules, validate } = require('../src/middleware/validate');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.post('/x', chatRules, validate, (req, res) => res.json({ ok: true }));
  return app;
}

const validAttachment = () => ({
  type: 'image',
  name: 'cat.jpg',
  mime: 'image/jpeg',
  data: Buffer.from('fakeimagedata').toString('base64'),
});

describe('chat attachment validation', () => {
  const app = buildApp();

  it('accepts a message with no attachment', async () => {
    const res = await request(app).post('/x').send({ message: 'hello' });
    expect(res.status).toBe(200);
  });

  it('accepts an explicit null attachment', async () => {
    const res = await request(app).post('/x').send({ message: 'hello', attachment: null });
    expect(res.status).toBe(200);
  });

  it('accepts a valid image attachment', async () => {
    const res = await request(app).post('/x').send({ message: 'hi', attachment: validAttachment() });
    expect(res.status).toBe(200);
  });

  it('accepts file and audio types', async () => {
    for (const type of ['file', 'audio']) {
      const res = await request(app).post('/x')
        .send({ message: 'hi', attachment: { ...validAttachment(), type } });
      expect(res.status).toBe(200);
    }
  });

  it('accepts an image-only message (empty text + attachment)', async () => {
    const res = await request(app).post('/x')
      .send({ message: '', attachment: validAttachment() });
    expect(res.status).toBe(200);
  });

  it('accepts a whitespace-only message when an attachment is present', async () => {
    const res = await request(app).post('/x')
      .send({ message: '   ', attachment: validAttachment() });
    expect(res.status).toBe(200);
  });

  it('still rejects an empty message without an attachment', async () => {
    const res = await request(app).post('/x').send({ message: '' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown attachment type', async () => {
    const res = await request(app).post('/x')
      .send({ message: 'hi', attachment: { ...validAttachment(), type: 'video' } });
    expect(res.status).toBe(400);
    expect(res.body.details.some(d => d.message.includes('image, file or audio'))).toBe(true);
  });

  it('rejects an attachment without data', async () => {
    const res = await request(app).post('/x')
      .send({ message: 'hi', attachment: { type: 'image', name: 'x.jpg' } });
    expect(res.status).toBe(400);
  });

  it('rejects non-base64 data', async () => {
    const res = await request(app).post('/x')
      .send({ message: 'hi', attachment: { type: 'image', data: '!!! not base64 !!!' } });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized attachment payload', async () => {
    const res = await request(app).post('/x')
      .send({ message: 'hi', attachment: { type: 'image', data: 'A'.repeat(4000001) } });
    expect(res.status).toBe(400);
    expect(res.body.details.some(d => d.message.includes('too large'))).toBe(true);
  });

  it('rejects an over-long attachment name', async () => {
    const res = await request(app).post('/x')
      .send({ message: 'hi', attachment: { ...validAttachment(), name: 'x'.repeat(256) } });
    expect(res.status).toBe(400);
  });

  it('rejects an attachment that is not an object', async () => {
    const res = await request(app).post('/x')
      .send({ message: 'hi', attachment: 'just-a-string' });
    expect(res.status).toBe(400);
  });
});
