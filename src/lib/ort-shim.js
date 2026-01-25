/**
 * Shim that provides onnxruntime-web API from globally loaded window.ort
 * ONNX runtime must be loaded via script tag before this is used
 *
 * All exports are getters that lazily access window.ort at runtime
 */

const getOrt = () => {
    if (typeof window === "undefined") {
        throw new Error("ort-shim: Cannot use ONNX runtime on server side");
    }
    if (!window.ort) {
        throw new Error(
            "ort-shim: window.ort not loaded. Load /vad/ort.min.js first.",
        );
    }
    return window.ort;
};

// Use a Proxy to lazily forward all property accesses to window.ort
const ortProxy = new Proxy(
    {},
    {
        get(target, prop) {
            return getOrt()[prop];
        },
        set(target, prop, value) {
            getOrt()[prop] = value;
            return true;
        },
    },
);

export const InferenceSession = new Proxy(
    {},
    {
        get(target, prop) {
            return getOrt().InferenceSession?.[prop];
        },
    },
);

export const Tensor = new Proxy(
    {},
    {
        get(target, prop) {
            return getOrt().Tensor?.[prop];
        },
    },
);

export const env = new Proxy(
    {},
    {
        get(target, prop) {
            return getOrt().env?.[prop];
        },
        set(target, prop, value) {
            if (getOrt().env) {
                getOrt().env[prop] = value;
            }
            return true;
        },
    },
);

export default ortProxy;
