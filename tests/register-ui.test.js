import { describe, expect, test } from 'bun:test';
import { registerUi } from '../resources/assets/index.js';
import { CheckboxRange } from '../resources/assets/controls/checkbox/checkbox-range.js';

const CONTROL_IDS = [
    'loader-container',
    'search-input',
    'custom-select',
    'popover',
    'popup',
    'tab',
    'datepicker',
    'input-hotkey',
    'input-trigger',
    'change-monitor',
    'drag-scroll',
    'toolbar',
    'rowlink',
    'checkbox',
    'formwidget',
    'listwidget',
    'filterwidget',
    'liststructurewidget',
    'fileupload',
    'relation-quick-create',
    'repeateraccordion',
    'repeaterbuilder',
];

function makeFakeJax() {
    const controls = new Map();

    return {
        controls,
        ControlBase: class {},
        registerControl(id, control) {
            if (controls.has(id)) {
                throw new Error(`duplicate control registration: ${id}`);
            }
            controls.set(id, control);
        },
        request() {},
    };
}

describe('registerUi', () => {
    test('importing the entry registers nothing and needs no global jax', () => {
        expect(window.jax).toBeUndefined();
    });

    test('registers every control against the given instance', () => {
        const jax = makeFakeJax();

        expect(registerUi(jax)).toBe(jax);
        expect([...jax.controls.keys()].sort()).toEqual([...CONTROL_IDS].sort());
    });

    test('registered controls extend the injected ControlBase', () => {
        const jax = makeFakeJax();
        registerUi(jax);

        for (const id of ['listwidget', 'tab', 'repeateraccordion']) {
            expect(jax.controls.get(id).prototype).toBeInstanceOf(jax.ControlBase);
        }
    });

    test('augments the instance with shared helpers', () => {
        const jax = makeFakeJax();
        registerUi(jax);

        expect(jax.CheckboxRange).toBeInstanceOf(CheckboxRange);
        expect(typeof jax.checkboxRangeRegisterClick).toBe('function');
        expect(typeof jax.changeMonitor).toBe('function');
        expect(typeof jax.InputPreset).toBe('function');
        expect(typeof jax.InputPresetEngine.formatValue).toBe('function');
    });

    test('repeated calls for the same instance are ignored', () => {
        const jax = makeFakeJax();
        registerUi(jax);
        const count = jax.controls.size;

        expect(registerUi(jax)).toBe(jax);
        expect(jax.controls.size).toBe(count);
    });

    test('a second instance registers its own control classes', () => {
        const first = makeFakeJax();
        const second = makeFakeJax();
        registerUi(first);
        registerUi(second);

        expect(second.controls.size).toBe(first.controls.size);
        expect(second.controls.get('tab')).not.toBe(first.controls.get('tab'));
        expect(second.controls.get('repeateraccordion').prototype).toBeInstanceOf(second.ControlBase);
    });

    test('an incompatible instance produces a clear error', () => {
        expect(() => registerUi(undefined)).toThrow(/control API/);
        expect(() => registerUi({})).toThrow(/control API/);
        expect(() => registerUi({ registerControl() {}, request() {} })).toThrow(/control API/);
    });
});
