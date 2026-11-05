export const CASECRAFT_SDK_VERSION = 1;

const CAPABILITY_TYPES = ["parser", "generator", "validator", "exporter", "automationAdapter"];

function validId(value = "") {
  return /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(String(value));
}

function validateCapability(type, capability) {
  if (!CAPABILITY_TYPES.includes(type)) throw new TypeError(`Tipe capability ${type} tidak didukung.`);
  if (!capability || !validId(capability.id) || !capability.label || typeof capability.run !== "function") {
    throw new TypeError(`${type} membutuhkan id namespaced, label, dan fungsi run.`);
  }
}

export function createCasecraftPlugin(definition = {}) {
  if (!validId(definition.id) || !definition.name) throw new TypeError("Plugin membutuhkan id namespaced dan nama.");
  if (definition.sdkVersion !== CASECRAFT_SDK_VERSION) throw new TypeError(`Plugin ${definition.id} membutuhkan SDK ${definition.sdkVersion}; Casecraft menyediakan SDK ${CASECRAFT_SDK_VERSION}.`);
  if (typeof definition.setup !== "function") throw new TypeError(`Plugin ${definition.id} harus menyediakan setup(api).`);
  return Object.freeze({ ...definition });
}

export function createPluginRegistry() {
  const plugins = new Map();
  const capabilities = Object.fromEntries(CAPABILITY_TYPES.map((type) => [type, new Map()]));
  return {
    register(pluginDefinition) {
      const plugin = createCasecraftPlugin(pluginDefinition);
      if (plugins.has(plugin.id)) throw new TypeError(`Plugin ${plugin.id} sudah terdaftar.`);
      const pending = [];
      const stageCapability = (type, capability) => {
        validateCapability(type, capability);
        if (!capability.id.startsWith(`${plugin.id}.`)) throw new TypeError(`Capability ${capability.id} harus memakai namespace ${plugin.id}.`);
        if (capabilities[type].has(capability.id) || pending.some((item) => item.type === type && item.capability.id === capability.id)) throw new TypeError(`Capability ${capability.id} sudah terdaftar.`);
        pending.push({ type, capability: Object.freeze({ ...capability, pluginId: plugin.id }) });
      };
      const api = Object.freeze({
        sdkVersion: CASECRAFT_SDK_VERSION,
        registerParser: (capability) => stageCapability("parser", capability),
        registerGenerator: (capability) => stageCapability("generator", capability),
        registerValidator: (capability) => stageCapability("validator", capability),
        registerExporter: (capability) => stageCapability("exporter", capability),
        registerAutomationAdapter: (capability) => stageCapability("automationAdapter", capability),
      });
      plugin.setup(api);
      pending.forEach(({ type, capability }) => capabilities[type].set(capability.id, capability));
      plugins.set(plugin.id, plugin);
      return plugin.id;
    },
    list(type = "") {
      if (type) {
        if (!CAPABILITY_TYPES.includes(type)) throw new TypeError(`Tipe capability ${type} tidak didukung.`);
        return [...capabilities[type].values()];
      }
      return [...plugins.values()].map(({ setup, ...metadata }) => ({ ...metadata }));
    },
    has(type, id) {
      return Boolean(capabilities[type]?.has(id));
    },
    async execute(type, id, input, context = {}) {
      const capability = capabilities[type]?.get(id);
      if (!capability) throw new TypeError(`Capability ${type}:${id} tidak terdaftar.`);
      return capability.run(input, Object.freeze({ ...context, sdkVersion: CASECRAFT_SDK_VERSION, pluginId: capability.pluginId }));
    },
  };
}
