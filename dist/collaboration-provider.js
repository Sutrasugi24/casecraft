const providers = new Map();

export const WORKSPACE_MODE = Object.freeze({ LOCAL: "local", COLLABORATIVE: "collaborative" });

export function registerCollaborationProvider(provider = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(provider.id || "") || !provider.label) throw new TypeError("Provider kolaborasi membutuhkan id dan label.");
  if (!provider.privacyPolicyUrl || !provider.consentText || typeof provider.connect !== "function") {
    throw new TypeError("Provider kolaborasi wajib memiliki kebijakan privasi, teks persetujuan, dan fungsi connect.");
  }
  if (providers.has(provider.id)) throw new TypeError(`Provider ${provider.id} sudah terdaftar.`);
  providers.set(provider.id, Object.freeze({ ...provider }));
  return provider.id;
}

export function collaborationCapabilities() {
  return { mode: WORKSPACE_MODE.LOCAL, providers: [...providers.values()], networkEnabled: false, explicitConsentRequired: true };
}

