/**
 * Central place for the app's identity.
 *
 * The working name lives in three files. When you rename the app, change:
 *   1. this file (APP_NAME / APP_SLUG)  -> everything the user sees
 *   2. app.json    ("name", "slug", "scheme")
 *   3. package.json ("name")
 */
export const APP_NAME = 'GymApp';
export const APP_SLUG = 'gymapp';
export const APP_VERSION = '1.0.0';

/**
 * Sent to Open Food Facts as the User-Agent contact (phase 2).
 * Must be a public URL, never a personal e-mail address.
 */
export const APP_CONTACT_URL = 'https://github.com/CHANGE-ME/gymapp';
export const OPEN_FOOD_FACTS_USER_AGENT = `${APP_NAME}/1.0 (${APP_CONTACT_URL})`;
