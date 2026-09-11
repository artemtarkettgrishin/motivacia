/** Генерирует google-apps-script/MotivaciyaBackend.gs из шаблона и сид-данных. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { SEED } from '../src/lib/seed';
import { buildBackendScript } from '../src/lib/backendScript';

mkdirSync('google-apps-script', { recursive: true });
writeFileSync('google-apps-script/MotivaciyaBackend.gs', buildBackendScript(SEED), 'utf8');
console.log('OK: google-apps-script/MotivaciyaBackend.gs');
