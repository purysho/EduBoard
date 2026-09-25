const test = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')
const sharp = require('sharp')
const { processProfilePhoto } = require('../services/profilePhoto')

const solid = (format, width = 800, height = 600) =>
  sharp({ create: { width, height, channels: 3, background: '#3366cc' } })[format]().toBuffer()

// A PNG whose header claims a 30000x30000 canvas: a few bytes on disk, gigabytes once
// decoded. Must be refused from the header alone.
function pngBomb() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(30000, 0)
  ihdr.writeUInt32BE(30000, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.alloc(1000))),
    chunk('IEND', Buffer.alloc(0))
  ])
}

for (const [format, name] of [['jpeg', 'me.jpg'], ['png', 'me.png'], ['webp', 'me.webp']]) {
  test(`accepts a real ${format} and stores a 512x512 WebP`, async () => {
    const result = await processProfilePhoto(name, await solid(format))
    assert.equal(result.ok, true, result.reason)
    const meta = await sharp(result.webp).metadata()
    assert.equal(meta.format, 'webp')
    assert.equal(meta.width, 512)
    assert.equal(meta.height, 512)
  })
}

test('strips EXIF, including GPS location, from phone photos', async () => {
  const withGps = await sharp(await solid('jpeg'))
    .withExif({ IFD0: { Make: 'PhoneCo', Copyright: 'x' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '22/1 16/1 0/1' } })
    .jpeg()
    .toBuffer()
  assert.ok((await sharp(withGps).metadata()).exif, 'fixture really has EXIF')
  const result = await processProfilePhoto('me.jpg', withGps)
  assert.equal(result.ok, true)
  const meta = await sharp(result.webp).metadata()
  assert.equal(meta.exif, undefined)
  assert.ok(!result.webp.includes(Buffer.from('PhoneCo')))
})

test('refuses other formats, even real images', async () => {
  for (const [name, bytes] of [
    ['me.gif', await solid('gif')],
    ['me.tiff', await solid('tiff')],
    ['me.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ['me.heic', Buffer.from('....ftypheic')]
  ]) {
    assert.equal((await processProfilePhoto(name, bytes)).ok, false, name)
  }
})

test('refuses disguised files', async () => {
  const cases = [
    ['a program renamed .jpg', 'me.jpg', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)])],
    ['an SVG renamed .png', 'me.png', Buffer.from('<svg><script>alert(1)</script></svg>')],
    ['a GIF renamed .png', 'me.png', await solid('gif')],
    ['a PNG renamed .jpg', 'me.jpg', await solid('png')],
    ['a JPEG header with nothing after it', 'me.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])],
    ['an empty file', 'me.png', Buffer.alloc(0)]
  ]
  for (const [label, name, bytes] of cases) {
    assert.equal((await processProfilePhoto(name, bytes)).ok, false, label)
  }
})

test('refuses a decompression bomb from its header, without decoding it', async () => {
  const started = Date.now()
  const result = await processProfilePhoto('bomb.png', pngBomb())
  assert.equal(result.ok, false)
  assert.match(result.reason, /too big/)
  assert.ok(Date.now() - started < 2000)
})

test('refuses files over the size cap before decoding', async () => {
  const result = await processProfilePhoto('me.png', Buffer.alloc(9 * 1024 * 1024, 1))
  assert.equal(result.ok, false)
  assert.match(result.reason, /too large/)
})
