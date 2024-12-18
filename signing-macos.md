# Distributing for MacOS

If you want your app to be runnable on MacOS without security warnings, you need to:
1. Pay Apple a fee to get a developer account
2. Install XCode and create signing credentials, certificates, and keychain entries on your Mac
3. Sign your app using your credentials via `codesign`
4. Notarize the app using your credentials via `notarytool`

The first two steps are fairly well documented and don't have any special requirements
imposed by Electron. Notarizing is also fairly simple. Signing an Electron app correctly
is what's tricky.

**Notarization** is an automated check where you upload your fully built foo.app bundle
to apple and it is checked for malware. If the notarizer is appeased, you will get a
certificate to "staple" to the app, and that will let it run on modern MacOS.

If you skip signing or notarization, your users will get a message saying "this binary is damaged, move it to the trash"
when they try to install your app. They could work around this by clearing extended attributes of the downloaded app
using `xattr`, but this usually isn't a reasonable thing to ask your users to do.

### 1. Getting an Apple Developer ID

From [here](https://www.electronjs.org/docs/latest/tutorial/code-signing):
Preparing macOS applications for release requires two steps: First, the app needs to be code signed. Then, the app needs to be uploaded to Apple for a process called notarization, where automated systems will further verify that your app isn't doing anything to endanger its users.

To start the process, ensure that you fulfill the requirements for signing and notarizing your app:

- Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) (requires an annual fee)
- Create an [application specific password](https://support.apple.com/en-us/102654) for notarytool

### 2. Getting certificates

- Download and install [Xcode](https://developer.apple.com/xcode) - this requires a computer running macOS
- Generate, download, and install [signing certificates](https://developer.apple.com/support/certificates/)

### 3. Code Signing

Electron Forge has osx-sign built in, but it isn't set up correctly by default, and (crucially) it doesn't
explain what's wrong when it fails. Instead of continuing to debug something that boils down to a one
line shell call, I have opted to just run `codesign` from the builder script. Steps:

1. Install your certificate on the computer you'll be building on. You can check that this is done like so:

2. Create a file called `~/.helloelectron-secrets.json` in your home directory
3. `chmod og-rw ~/.helloelectron-secrets.json`
3. Put the following details into it:
```
{
  "notarytoolPassword": "your-application-specific-password-for-notarytool",
  "appleDeveloperId": "yourname@yourcompany.com",
  "appleTeamId": "YOUR_TEAM_ID_HERE",
  "appleSignature": "YOUR_KEYCHAIN_KEY_ID"
}
```

You can get the `YOUR_KEYCHAIN_KEY_ID` by running `security find-identity -p codesigning -v`. The ID it
wants is the long all-caps hex string that is at the beginning of the identity summary, before the
quoted string that names the cert.


4. Run `node ./electron/scripts/builder.js notarize` and this time it will try to sign.





# Troubleshooting

### 1. No signing identity

The public docs are fairly clear, but the final steps of installing the cert on your machine's keychain
can have subtle problems. I didn't solve this, it just happened to work on one of my MacOS laptops,
but failed on the other one. I suspect the cause of the latter is trying to use an old XCode or an old
MacOS.

You can check if the cert is being recognized for signing like this:
```
$ security find-identity -p codesigning -v
  1) YOUR_KEYCHAIN_KEY_ID "Developer ID Application: Yourname Lastname (YOUR_TEAM_ID_HERE)"
     1 valid identities found
$
```
...if it says "0 identities" or "0 valid identities" then it hasn't worked.



### 2. `codesign` fails

If `codesign` gives an error, look at the messages carefully. It might complain about symlinks, or it might
try to sign files that aren't in your project. You may have to edit `electron/main/lib/darwin/signing.json`
to list whatever binary files are being pulled in by your npm modules. See below for more on how to guess
what those should be.

If you're having other kinds of problems related to signing or entitlements, read this:

[--deep Considered Harmful](https://developer.apple.com/forums/thread/129980)

...one problem that can happen is that codesign can sign everything, but notarytool will be more picky.
The way I found to address this is basically to run `notarize` once, look at the log of failures,
and then list all the paths it complains about in `electron/main/lib/darwin/signing.json` so that
codesign will see them. After that, run the sign and notarize again.


### 3. `notarytool` fails with "invalid submission"

The Apple notary service offers a very clear log of exactly what's wrong with your binary. You can see it
by capturing the submission ID from the failure log, it's usually in the last couple of lines and looks like
a hex UUID like `5555555e-3d8b-469a-a1da-60000e00aa00` or similar. Re-run notarytool with the same
arguments as the builder ran, but give it the `log` command like so:

```
xcrun notarytool log --apple-id yourname@yourcompany.com --team-id YOUR_TEAM_ID_HERE --password your-application-specific-password-for-notarytool NOTARYTOOL_FAILED_SUBMISSION_ID > /tmp/notarize-log.txt
```

... this will give you a JSON list of complaints about your bundle. For me the problem was that there were
many binaries in the bundle which notarytool caught but which codesign did not find, even with `--deep`.
What I did was basically put all of the mentioned binaries into `electron/main/lib/darwin/signing.json`
and then sign and notarize again. It worked the second time.
