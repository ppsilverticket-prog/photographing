This is the Expo/React Native app for 포토그래핑 (iOS + Android). Prioritize mobile-first patterns, performance, and cross-platform compatibility. Product docs live in `../docs/` — read `../docs/07-operations-policy.md` before changing safety, reporting, no-show, or photo-upload behavior; the rules in `src/domain/` implement it.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently SDK 57).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions.
4. If the docs site is unreachable, read the installed type definitions in `node_modules/<package>/build/*.d.ts` instead of guessing.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm add — resolves SDK-compatible versions
npx expo start              # start the dev server (scan the QR code with Expo Go)
npm run lint                # expo lint
npm run typecheck           # tsc --noEmit
npm test                    # jest (domain rules + store reducer)
npx expo export --platform web --output-dir dist-web   # static web build for previews
```

In the Claude Code cloud environment, api.expo.dev is blocked by the network policy. Prefix `expo install` and `expo export` with `EXPO_OFFLINE=1` there.

Run lint, typecheck, and tests before declaring any task done.

## Structure

- `App.tsx` — fonts and providers. Import each font weight by path (`@expo-google-fonts/ibm-plex-sans-kr/700Bold`); the package index pulls in every weight (~2.8MB each).
- `src/domain/` — pure rules with tests: no-show limits, meetup validation, EXIF summary, date formatting. No React imports here.
- `src/data/` — `mock.ts` seed data and `store.tsx` (React context + reducer). The reducer is the seam where Supabase calls will replace in-memory updates.
- `src/navigation/` — React Navigation native stack + bottom tabs.
- `src/screens/`, `src/components/` — UI. Colors and fonts come from `src/theme.ts`; don't hardcode colors in screens.

## Navigation

This project uses **React Navigation** directly (not Expo Router). The choice keeps the web build independent of the page URL so it runs inside sandboxed preview links. Add screens to `RootStackParamList` in `src/navigation/types.ts` and register them in `RootNavigator.tsx`. Deep links (meetup share links) will be added through React Navigation's `linking` config.

Import icons as `import Ionicons from '@expo/vector-icons/Ionicons'`, not from the package root, which bundles every icon font.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`npx eas-cli@latest build`, `submit`, `update`) — no local Xcode or Android Studio required.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. Kakao login, PASS identity verification, and Kakao Map need native code, so adding them requires a development build (`eas build --profile development`).
- The app must not collect device location (policy D1). Photos are re-encoded before upload to drop EXIF including GPS (policy D2); keep that path intact.
- Prefer recommended Expo modules over third-party libraries.
