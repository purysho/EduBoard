// Profile photos: accept only JPEG, PNG or WebP, and never store what was uploaded.
// Each photo is decoded and re-encoded from its pixels, so whatever else the file
// carried (EXIF with the phone's GPS location, a polyglot payload, junk after the image
// data) is gone, and every stored photo is a small, square WebP.
const sharp = require('sharp')
const { checkUpload } = require('./fileSafety')

const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
// Phones produce up to ~50 megapixels. Anything claiming far more is refused before
// decoding, so a tiny file declaring a gigantic canvas can't exhaust server memory.
const MAX_INPUT_PIXELS = 100_000_000
const OUTPUT_SIZE = 512

/** Returns { ok: true, webp } or { ok: false, reason } — never throws. */
async function processProfilePhoto(fileName, bytes) {
  const ext = (/\.([a-z0-9]+)$/i.exec(String(fileName))?.[1] ?? '').toLowerCase()
  if (!PHOTO_EXTENSIONS.includes(ext)) {
    return { ok: false, reason: 'Photos must be .jpg, .png or .webp' }
  }
  if (bytes.length > MAX_PHOTO_BYTES)
    return { ok: false, reason: 'That photo is too large (8 MB max)' }
  const check = checkUpload(String(fileName), bytes)
  if (!check.ok) return { ok: false, reason: `That isn't a usable photo: ${check.reason}` }

  try {
    const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
    const meta = await image.metadata()
    // The decoder's own verdict has to agree with the file's signature, too.
    const decodedAs = { jpeg: 'jpg', png: 'png', webp: 'webp' }[meta.format]
    if (!decodedAs || decodedAs !== check.kind) {
      return { ok: false, reason: "That isn't a JPEG, PNG or WebP image" }
    }
    const webp = await image
      .rotate() // apply the camera's orientation before the EXIF that held it is dropped
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer() // sharp writes no metadata unless asked, so EXIF/GPS/ICC comments are gone
    return { ok: true, webp }
  } catch (err) {
    const tooBig = /pixel limit/i.test(err.message)
    return {
      ok: false,
      reason: tooBig
        ? 'That image is too big to process'
        : "That image couldn't be read — it may be damaged"
    }
  }
}

module.exports = { processProfilePhoto, PHOTO_EXTENSIONS, MAX_PHOTO_BYTES }
