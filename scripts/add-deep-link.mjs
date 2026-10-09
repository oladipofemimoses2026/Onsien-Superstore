// Adds the app's "return address" (com.ojapantry.app://) to the Android project,
// so Google sign-in can send the customer back into the app.
// Runs during the GitHub build, after "npx cap add android".
import { readFileSync, writeFileSync } from 'node:fs';

const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const SCHEME = 'com.ojapantry.app';

let xml = readFileSync(MANIFEST, 'utf8');

if (xml.includes(`android:scheme="${SCHEME}"`)) {
  console.log('Deep link already present. Nothing to do.');
  process.exit(0);
}

const intentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEME}" />
            </intent-filter>
        `;

const marker = '</activity>';
const index = xml.indexOf(marker);

if (index === -1) {
  console.error('Could not find </activity> in AndroidManifest.xml');
  process.exit(1);
}

xml = xml.slice(0, index) + intentFilter + xml.slice(index);
writeFileSync(MANIFEST, xml);
console.log(`Deep link added: ${SCHEME}://`);
