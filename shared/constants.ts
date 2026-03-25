/**
 * ATK systémové konštanty – centralizácia identity
 *
 * Tento súbor je jediným zdrojom pravdy pre rezervované systémové UID.
 * Nemeňte hodnoty bez koordinácie s celou databázou a kódom.
 */

/**
 * UID systémového subjektu ArutsoK (ATK).
 * Vlastník automatizovaných procesov, systémových logov a licencií.
 * DB: subjects.type = 'system', subjects.id = 235
 */
export const ATK_SYSTEM_ID = "421000000000000";

/**
 * Rezervované UID pre budúceho superadmina ATK.
 * Zatiaľ len rezervovaná konštanta – subjekt v DB neexistuje.
 * Má najvyššie prístupové práva, ale NIE je vlastníkom systémových procesov.
 */
export const ATK_SUPERADMIN_ID = "421000000000002";
