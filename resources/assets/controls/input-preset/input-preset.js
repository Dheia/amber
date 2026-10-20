/*
 * An input preset converter.
 *
 * The API allows to convert text entered into an element to a URL, slug or file name
 * value in another input element.
 *
 * Supported data attributes:
 * - data-input-preset: specifies a CSS selector for a source input element
 * - data-input-preset-closest-parent: optional, specifies a CSS selector for a closest common parent
 *   for the source and destination input elements.
 * - data-input-preset-type: specifies the conversion type. Supported values are:
 *   url, file, slug, camel.
 * - data-input-preset-prefix-input: optional, prefixes the converted value with the value found
 *   in the supplied input element using a CSS selector.
 * - data-input-preset-remove-words: optional, use removeList to filter stop words of source string.
 *
 * Example: <input type="text" id="name" value=""/>
 *          <input type="text"
 *             data-input-preset="#name"
 *             data-input-preset-type="file">
 *
 * JavaScript API:
 * new jax.InputPreset(element, { inputPreset: '#name', inputPresetType: 'file' })
 * jax.InputPreset.getInstance(element) - the preset created for a data-input-preset element
 */
'use strict';

import { InputPresetEngine } from './input-preset-engine.js';

// Framework instance bound by registerInputPreset
let jax = null;

// Input preset instances created for data-input-preset elements
const instances = new WeakMap();

export class InputPreset {
    static DEFAULTS = {
        inputPreset: '',
        inputPresetType: 'slug',
        inputPresetClosestParent: undefined,
        inputPresetPrefixInput: undefined,
        inputPresetRemoveWords: true
    };

    constructor(element, options) {
        this.element = element;
        this.options = options || {};
        this.cancelled = false;

        const parent = options.inputPresetClosestParent !== undefined
                ? element.closest(options.inputPresetClosestParent)
                : undefined,
            scope = parent || document,
            self = this;

        let prefix = '';

        if (options.inputPresetPrefixInput !== undefined) {
            prefix = scope.querySelector(options.inputPresetPrefixInput)?.value;
        }

        if (prefix === undefined || prefix === null) {
            prefix = '';
        }

        // Do not update the element if it already has a value and the value doesn't match the prefix
        if (element.value.length && element.value != prefix) {
            return;
        }

        element.value = prefix;
        jax.Events.dispatch('input-preset:after-update', { target: element });

        this.src = scope.querySelector(options.inputPreset);

        if (!this.src) {
            return;
        }

        const onSourceInput = function(event) {
            if (self.cancelled) {
                return;
            }

            const timeout = event.type === 'paste' ? 100 : 0;
            const updateValue = function(self, el, prefix) {
                if (el.dataset.update === 'false') {
                    return;
                }
                el.value = prefix + jax.InputPresetEngine.formatValue(options, self.src.value);
                jax.Events.dispatch('input-preset:after-update', { target: el });
            };

            setTimeout(function() {
                jax.Events.dispatch('input-preset:before-update', { target: self.element, detail: { src: self.src } });
                setTimeout(updateValue, 100, self, self.element, prefix);
            }, timeout);
        };

        this.src.addEventListener('input', onSourceInput);
        this.src.addEventListener('paste', onSourceInput);

        element.addEventListener('change', function() {
            self.cancelled = true;
        });
    }

    static getInstance(element) {
        return instances.get(element) || null;
    }
}

export function registerInputPreset(framework) {
    jax = framework;

    // Instances
    jax.InputPresetEngine = new InputPresetEngine;
    jax.InputPreset = InputPreset;

    // CUSTOM RENDERER
    // ============================

    addEventListener('render', function() {
        document.querySelectorAll('[data-input-preset]:not([data-oc-input-preset])').forEach(function(element) {
            element.dataset.ocInputPreset = '';

            const options = Object.assign({}, InputPreset.DEFAULTS);
            for (const key in element.dataset) {
                if (key.startsWith('inputPreset')) {
                    options[key] = element.dataset[key] === 'false' ? false : element.dataset[key];
                }
            }

            instances.set(element, new InputPreset(element, options));
        });
    });
}
