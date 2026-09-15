# Releasing Ruru

Ruru ships **one** Android artifact:

```
Ruru-v<versionName>-arm64-v8a-release.apk
```

- signing: the permanent Ruru release key (never committed, never regenerated)
- ABI: `arm64-v8a` only
- applicationId: `com.mishaqp.ruru`
- Kotlin namespace stays `com.zhousl.aether` on purpose — renaming it would touch
  the whole tree for no functional gain.

## Versioning

| Field | Value | Notes |
| --- | --- | --- |
| versionName | `0.1.0-ruru.1` | `MAJOR.MINOR.PATCH-ruru.<revision>` |
| versionCode | `10001` | `major*1000000 + minor*10000 + patch*100 + revision` |

The in-app updater compares the **numeric core** of the tag (`0.1.0`), so the
numeric part must grow for the updater to offer a release. Use the `-ruru.N`
counter for rebuilds of the same numeric version.

`versionCode` must only ever increase: Android refuses to install a lower
versionCode over an installed app.

## Repository secrets

The release workflow reads four secrets. They are required; the build fails
early with a clear message when they are missing.

| Secret | Meaning |
| --- | --- |
| `RURU_KEYSTORE_BASE64` | base64 of `ruru-release.jks` |
| `RURU_KEYSTORE_PASSWORD` | keystore password |
| `RURU_KEY_ALIAS` | `ruru` |
| `RURU_KEY_PASSWORD` | key password |

Keystore parameters: RSA 4096, alias `ruru`, validity 10000 days, PKCS12.

> Keep an offline copy of the keystore and its passwords. Losing the key means
> every installed Ruru blocks future updates forever, because Android rejects an
> APK signed with a different certificate.

## Cutting a release

1. Bump the version (numeric core for a real release):
   `git tag v0.1.0-ruru.1 && git push origin v0.1.0-ruru.1`
2. `.github/workflows/release-ruru.yml` builds, verifies and publishes the
   release with the APK and `RURU_SIGNING_CERT_SHA256.txt`.

Manual run: **Actions → Release Ruru APK → Run workflow** with `version_name`
and `version_code` (does not publish a release unless a `v*` tag triggered it).

## What the workflow verifies

- APK is signed (`apksigner verify --verbose --print-certs`)
- no ABI other than `arm64-v8a` is present
- `AndroidManifest.xml` does not declare `testOnly`
- package name is `com.mishaqp.ruru` and versionName matches the request
- SHA-256 of the signing certificate is recorded and published with the release

The certificate fingerprint must stay identical across releases. Compare it with
`RURU_SIGNING_CERT_SHA256.txt` from a previous release before shipping.

## Why R8 is off

`isMinifyEnabled` / `isShrinkResources` are disabled for release builds. The app
loads extensions, Native Mods (runtime DEX) and the Termux/Alpine JNI layers
through reflection-heavy paths; a shrinker can strip classes that only appear in
those lookups, producing an APK that installs but crashes at runtime. Re-enable
shrinking only after a release has been smoke-tested with it on.
