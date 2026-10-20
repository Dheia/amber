import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { registerFormWidget } from '../resources/assets/widgets/form/form.js';
import { registerTab } from '../resources/assets/controls/tab/tab.js';
import { LoadIndicator } from '../resources/assets/controls/load-indicator/load-indicator.js';

function makeFakeJax() {
    const instances = new Map();

    class ControlBase {
        constructor(element) {
            this.element = element;
            this.config = {};
            this.proxied = new Map();

            for (const attr of element.attributes) {
                if (attr.name.startsWith('data-')) {
                    const key = attr.name.slice(5).replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                    this.config[key] = attr.value;
                }
            }
        }

        proxy(method) {
            if (!this.proxied.has(method)) {
                this.proxied.set(method, method.bind(this));
            }
            return this.proxied.get(method);
        }

        // Supports listen(event, handler) and the delegated listen(event, selector, handler)
        listen(eventName, selectorOrHandler, handler) {
            if (typeof selectorOrHandler === 'string') {
                this.element.addEventListener(eventName, (ev) => {
                    const target = ev.target.closest && ev.target.closest(selectorOrHandler);
                    if (target && this.element.contains(target)) {
                        ev.delegateTarget = target;
                        handler.call(this, ev);
                    }
                });
            }
            else {
                this.element.addEventListener(eventName, selectorOrHandler.bind(this));
            }
        }
    }

    return {
        requests: [],
        controls: new Map(),
        ControlBase,
        registerControl(id, control) {
            this.controls.set(id, control);
        },
        connect(id, element) {
            const control = new (this.controls.get(id))(element);
            control.init();
            control.connect();
            instances.set(element, control);
            return control;
        },
        fetchControl(element) {
            return instances.get(element) || null;
        },
        request(element, handler, options) {
            const request = { element, handler, options, doneCallbacks: [] };
            this.requests.push(request);
            return { done(fn) { request.doneCallbacks.push(fn); return this; } };
        },
        parseJSON(value) {
            return new Function('return ' + value)();
        },
        checkboxRangeRegisterClick() {},
        Events: {
            dispatch(name, { target = document, detail = {} } = {}) {
                target.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: true, detail }));
            }
        }
    };
}

let jax;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(() => {
    jax = makeFakeJax();
    registerFormWidget(jax);
    registerTab(jax);
});

afterEach(() => {
    document.body.innerHTML = '';
    jax.requests = [];
});

function connectForm(html, attributes = '') {
    document.body.innerHTML = `<form><div data-control="formwidget" data-refresh-handler="form::onRefresh" ${attributes}>${html}</div></form>`;

    // Tab controls connect before the form, like the framework connecting children
    document.querySelectorAll('[data-control="tab"]').forEach((el) => jax.connect('tab', el));

    const control = jax.connect('formwidget', document.querySelector('[data-control="formwidget"]'));
    control.dependantUpdateInterval = 0;
    return control;
}

function change(el) {
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('dependent fields', () => {
    const fields = `
        <div class="form-group" data-field-name="country" id="f-country"><select name="country"><option value="au">AU</option></select></div>
        <div class="form-group" data-field-name="state" data-field-depends='["country"]' id="f-state"><input name="state"></div>
        <div class="form-group" data-field-name="city" data-field-depends='["state"]' id="f-city"><input name="city"></div>
    `;

    test('changing a master refreshes its dependents once, with the refresh data', async () => {
        connectForm(fields, `data-refresh-data="mode: 'quick'"`);

        change(document.querySelector('[name=country]'));
        change(document.querySelector('[name=country]'));
        await sleep(5);

        expect(jax.requests).toHaveLength(1);
        expect(jax.requests[0].handler).toBe('form::onRefresh');
        expect(jax.requests[0].element).toBe(document.querySelector('form'));
        expect(jax.requests[0].options.data).toEqual({ fields: ['state'], mode: 'quick' });
    });

    test('refreshed fields announce a change so their own dependents refresh', async () => {
        connectForm(fields);

        change(document.querySelector('[name=country]'));
        await sleep(5);
        jax.requests[0].doneCallbacks.forEach((fn) => fn());
        await sleep(5);

        expect(jax.requests).toHaveLength(2);
        expect(jax.requests[1].options.data).toEqual({ fields: ['city'] });
    });

    test('fields of a nested form are left to that form', async () => {
        connectForm(`
            <div class="form-group" data-field-name="title"><input name="title"></div>
            <div data-control="formwidget">
                <div class="form-group" data-field-name="slug" data-field-depends='["title"]'><input name="slug"></div>
            </div>
        `);

        change(document.querySelector('[name=title]'));
        await sleep(5);

        expect(jax.requests).toHaveLength(0);
    });
});

describe('change handlers', () => {
    test('a field with a change handler calls it on change', async () => {
        connectForm(`<div class="form-group" data-field-name="name" data-change-handler="onNameChange"><input name="name"></div>`);

        change(document.querySelector('[name=name]'));
        await sleep(5);

        expect(jax.requests).toHaveLength(1);
        expect(jax.requests[0].handler).toBe('onNameChange');
        expect(jax.requests[0].element).toBe(document.querySelector('[data-change-handler]'));
    });
});

describe('checkbox lists', () => {
    const list = (classes = '') => `
        <div class="form-group" data-field-name="tags">
            <div class="field-checkboxlist ${classes}">
                <div class="checkboxlist-controls">
                    <a href="javascript:;" class="control-button" data-field-checkboxlist-all>All</a>
                    <a href="javascript:;" class="control-button" data-field-checkboxlist-none>None</a>
                </div>
                <div class="form-check"><input type="checkbox" name="tags[]" value="1"></div>
                <div class="form-check"><input type="checkbox" name="tags[]" value="2" disabled></div>
                <div class="form-check"><input type="checkbox" name="tags[]" value="3" checked></div>
            </div>
        </div>
    `;

    test('select all and none skip disabled options and announce the change', () => {
        connectForm(list());
        const boxes = [...document.querySelectorAll('input[type=checkbox]')];
        let changes = 0;
        document.addEventListener('change', () => changes++);

        document.querySelector('[data-field-checkboxlist-all]').click();
        expect(boxes.map((box) => box.checked)).toEqual([true, false, true]);

        document.querySelector('[data-field-checkboxlist-none]').click();
        expect(boxes.map((box) => box.checked)).toEqual([false, false, false]);
        expect(changes).toBe(2);
    });

    test('a disabled list disables its options and buttons, and the trigger re-enables them', () => {
        connectForm(list('control-disabled'));
        const field = document.querySelector('.field-checkboxlist');

        expect(field.querySelector('input[value="1"]').disabled).toBe(true);
        document.querySelector('[data-field-checkboxlist-all]').click();
        expect(field.querySelector('input[value="1"]').checked).toBe(false);

        field.classList.remove('control-disabled');
        jax.Events.dispatch('trigger:after-update', { target: field });

        expect(field.querySelector('input[value="1"]').disabled).toBe(false);
        expect(field.querySelector('input[value="2"]').disabled).toBe(true);
    });

    test('a trigger empty action clears the list', () => {
        connectForm(list());
        const field = document.querySelector('.field-checkboxlist');

        jax.Events.dispatch('trigger:empty', { target: field });

        expect(field.querySelector('input[value="3"]').checked).toBe(false);
    });
});

describe('tabs', () => {
    const tabs = (firstPane, secondPane, firstLazy = false) => `
        <div class="control-tabs" data-control="tab">
            <ul class="nav nav-tabs">
                <li class="active"><a href="#pane-one">One</a></li>
                <li class="${firstLazy ? 'tab-lazy' : ''}"><a href="#pane-two" data-tab-name="Two" data-tab-section="primary" data-tab-lazy-handler="form::onLazyLoadTab">Two</a></li>
            </ul>
            <div class="tab-content">
                <div class="tab-pane active" id="pane-one">${firstPane}</div>
                <div class="tab-pane" id="pane-two">${secondPane}</div>
            </div>
        </div>
    `;

    test('empty tabs are hidden and the first visible tab is selected', async () => {
        connectForm(tabs('', '<div class="form-group" data-field-name="name"><input name="name"></div>'));
        await sleep(5);

        const items = document.querySelectorAll('.nav-tabs > li');
        expect(items[0].style.display).toBe('none');
        expect(items[1].classList.contains('active')).toBe(true);
        expect(document.getElementById('pane-two').classList.contains('active')).toBe(true);
    });

    test('showing a lazy tab loads its fields from the form handler', () => {
        connectForm(tabs('<div class="form-group" data-field-name="name"><input name="name"></div>', '', true));
        const anchor = document.querySelector('a[href="#pane-two"]');

        anchor.click();

        expect(jax.requests).toHaveLength(1);
        expect(jax.requests[0].handler).toBe('form::onLazyLoadTab');
        expect(jax.requests[0].options.data).toEqual({ target: '#pane-two', name: 'Two', section: 'primary' });

        let applied = null;
        jax.requests[0].options.success.call({ success: (data) => { applied = data; } }, { '#pane-two': 'fields' });

        expect(applied).toEqual({ '#pane-two': 'fields' });
        expect(anchor.parentElement.classList.contains('tab-lazy')).toBe(false);
    });

    test('the first invalid field has its tab shown and is focused', () => {
        connectForm(tabs('<div class="form-group" data-field-name="name"><input name="name"></div>', '<div class="form-group" data-field-name="email"><input name="email"></div>'));
        const email = document.querySelector('[name=email]');

        const ev = new CustomEvent('ajax:invalid-field', { cancelable: true, detail: { element: email, fieldName: 'email', isFirst: true } });
        window.dispatchEvent(ev);

        expect(ev.defaultPrevented).toBe(true);
        expect(document.getElementById('pane-two').classList.contains('active')).toBe(true);
        expect(document.activeElement).toBe(email);
    });

    test('later invalid fields leave the tabs alone', () => {
        connectForm(tabs('<div class="form-group" data-field-name="name"><input name="name"></div>', '<div class="form-group" data-field-name="email"><input name="email"></div>'));

        window.dispatchEvent(new CustomEvent('ajax:invalid-field', { cancelable: true, detail: { element: document.querySelector('[name=email]'), isFirst: false } }));

        expect(document.getElementById('pane-one').classList.contains('active')).toBe(true);
    });
});

describe('collapsible sections', () => {
    test('a collapsible section hides the fields up to the next section until clicked', () => {
        connectForm(`
            <div class="form-group section-field" data-field-collapsible><div class="field-section"><h4>Details</h4></div></div>
            <div class="form-group" data-field-name="a"><input name="a"></div>
            <div class="form-group" data-field-name="b"><input name="b"></div>
            <div class="form-group section-field"><div class="field-section"><h4>Other</h4></div></div>
            <div class="form-group" data-field-name="c"><input name="c"></div>
        `);
        const section = document.querySelector('[data-field-collapsible]'),
            visible = () => ['a', 'b', 'c'].map((name) => document.querySelector(`[data-field-name=${name}]`).style.display !== 'none');

        expect(section.classList.contains('collapsed')).toBe(true);
        expect(section.querySelector('.field-section').classList.contains('is-collapsible')).toBe(true);
        expect(visible()).toEqual([false, false, true]);

        section.click();
        expect(visible()).toEqual([true, true, true]);
        expect(section.classList.contains('collapsed')).toBe(false);
    });
});

describe('load indicator', () => {
    test('shows a spinner inside the container until hidden', () => {
        document.body.innerHTML = '<div id="box"><input></div>';
        const box = document.getElementById('box');

        LoadIndicator.show(box, { text: 'Saving...' });
        expect(box.classList.contains('in-progress')).toBe(true);
        expect(box.firstElementChild.classList.contains('loading-indicator')).toBe(true);
        expect(box.firstElementChild.textContent).toBe('Saving...');

        LoadIndicator.hide(box);
        expect(box.querySelector('.loading-indicator')).toBeNull();
        expect(box.classList.contains('in-progress')).toBe(false);
    });
});
