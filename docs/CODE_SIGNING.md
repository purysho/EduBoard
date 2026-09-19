# Code signing releases

By default, release builds (`.github/workflows/release.yml`, and `npm run build:win` /
`build:mac` locally) are unsigned. That's fine to develop against, but an unsigned
build triggers a SmartScreen warning on Windows and a Gatekeeper block on macOS, which
is worth fixing before handing the app to non-technical users (teachers).

Signing is entirely opt-in: with none of the secrets below set, nothing about the build
changes. `electron-builder.yml` never has to be touched to turn it on or off — it reacts
to whichever of these environment variables are present.

## Windows

You need a code-signing certificate from a CA (DigiCert, Sectigo, etc. — expect
$100–400/yr) or a cheaper cloud-based option like [Azure Trusted
Signing](https://learn.microsoft.com/azure/trusted-signing/overview). For a traditional
`.pfx`/`.p12` certificate:

1. Base64-encode the certificate file: `base64 -i your-cert.pfx | pbcopy` (or `-w0` on
   Linux).
2. Add two repo secrets (Settings → Secrets and variables → Actions):
   - `CSC_LINK` — the base64 string from step 1 (or a URL to the `.pfx`).
   - `CSC_KEY_PASSWORD` — the certificate's password.

electron-builder picks these up automatically for the Windows build — no YAML changes
needed.

## macOS

Requires an [Apple Developer Program](https://developer.apple.com/programs/) membership
($99/yr) — needed for both signing and notarization (macOS won't run an unnotarized
downloaded app without a manual override).

1. In Xcode or the Apple Developer portal, create a "Developer ID Application"
   certificate and export it as a `.p12` from Keychain Access.
2. Base64-encode it the same way as the Windows cert.
3. Generate an app-specific password at [appleid.apple.com](https://appleid.apple.com)
   (Sign-In and Security → App-Specific Passwords) — do not use your real Apple ID
   password.
4. Add these repo secrets:
   - `CSC_LINK` / `CSC_KEY_PASSWORD` — the `.p12` and its password (same names as
     Windows; each platform's CI job only reads what it needs).
   - `APPLE_ID` — your Apple ID email.
   - `APPLE_APP_SPECIFIC_PASSWORD` — the app-specific password from step 3.
   - `APPLE_TEAM_ID` — found in the Developer portal under Membership.

With all three Apple secrets set, electron-builder notarizes the build automatically
after signing (`mac.hardenedRuntime: true` in `electron-builder.yml` is required for
this and is already on).

## Verifying a signed build

- Windows: right-click the `.exe` → Properties → Digital Signatures tab should list your
  certificate.
- macOS: `codesign -dv --verbose=4 EduBoard.app` and `spctl -a -vv EduBoard.app` should
  both report accepted/valid; `xcrun stapler validate EduBoard.app` confirms the
  notarization ticket is stapled.

## Local builds

The same env vars work locally: `CSC_LINK=... CSC_KEY_PASSWORD=... npm run build:mac`
(etc.) signs a build on your own machine without touching CI secrets.
