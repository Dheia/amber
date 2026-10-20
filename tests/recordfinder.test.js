import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { Popup, registerPopup } from '../resources/assets/controls/popup/popup.js';
import { registerRecordFinder } from '../resources/assets/formwidgets/recordfinder/recordfinder.js';
import { registerAjax } from '../resources/assets/ajax.js';

// Mirrors the Bootstrap 5 Modal surface the popup uses, firing its native events synchronously
class FakeModal {
    constructor(element) {
        this.element = element;
    }

    trigger(name) {
        this.element.dispatchEvent(new Event(name, { bubbles: true, cancelable: true }));
    }

    show() {
        this.trigger('show.bs.modal');
        if (!document.body.contains(this.element)) {
            document.body.append(this.element);
        }
        this.element.classList.add('show');
        this.trigger('shown.bs.modal');
    }

    hide() {
        this.trigger('hide.bs.modal');
        this.element.classList.remove('show');
        this.trigger('hidden.bs.modal');
    }

    dispose() {}
}

function makeFakeJax() {
    class ControlBase {
        constructor(element) {
            this.element = element;
            this.config = {};

            for (const attr of element.attributes) {
                if (attr.name.startsWith('data-')) {
                    const key = attr.name.slice(5).replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                    this.config[key] = attr.value;
                }
            }
        }

        listen(eventName, handler) {
            this.element.addEventListener(eventName, handler.bind(this));
        }
    }

    return {
        controls: new Map(),
        requests: [],
        ControlBase,
        registerControl(id, control) {
            this.controls.set(id, control);
        },
        request(element, handler, options) {
            this.requests.push({ element, handler, options });
        },
        parseJSON(value) {
            return new Function('return ' + value)();
        },
        values(form) {
            return Object.fromEntries(new FormData(form).entries());
        },
        Events: {
            dispatch(name, { target = document, detail = {} } = {}) {
                target.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: true, detail }));
            }
        }
    };
}

let jax;

beforeAll(() => {
    window.bootstrap = { Modal: FakeModal };
    jax = makeFakeJax();
    registerPopup(jax);
    registerRecordFinder(jax);
    registerAjax(jax);
});

afterEach(() => {
    document.body.innerHTML = '';
    jax.requests = [];
});

function connectFinder() {
    document.body.innerHTML = `
        <form>
            <div id="finder" data-control="recordfinder" data-refresh-handler="formOwner::onRefresh" data-data-locker="#locker">
                <button type="button" class="toolbar-find-button">Select</button>
                <input type="hidden" name="owner" id="locker" value="">
            </div>
        </form>
    `;

    const element = document.getElementById('finder');
    const control = new (jax.controls.get('recordfinder'))(element);
    control.init();
    control.connect();

    return { element, control };
}

describe('record finder', () => {
    test('picking a record fills the locker, refreshes the field and closes the popup', () => {
        const { element, control } = connectFinder();
        const popup = Popup.open({ content: '<div class="recordfinder-popup"><table><tr id="row"><td>Row</td></tr></table></div>' });
        const container = popup.container;
        let changed = false;
        document.addEventListener('change', (ev) => { changed = ev.target.id === 'locker'; });

        control.updateRecord(document.getElementById('row'), '42');

        expect(document.getElementById('locker').value).toBe('42');
        expect(jax.requests).toHaveLength(1);
        expect(jax.requests[0].element).toBe(element);
        expect(jax.requests[0].handler).toBe('formOwner::onRefresh');
        expect(element.classList.contains('in-progress')).toBe(true);
        expect(container.classList.contains('show')).toBe(false);
        expect(container.isConnected).toBe(false);

        jax.requests[0].options.afterUpdate();
        expect(changed).toBe(true);
    });

    test('double clicking the field opens the finder', () => {
        const { element } = connectFinder();
        let clicked = false;
        element.querySelector('.toolbar-find-button').addEventListener('click', () => { clicked = true; });

        element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

        expect(clicked).toBe(true);
    });
});

describe('parent form data', () => {
    test('a form marked with data-request-parent-form sends the parent form state', () => {
        document.body.innerHTML = `
            <div data-request-data="section: 'main'">
                <form id="parent-form">
                    <input name="name" value="Ada">
                    <div data-request-data="mode: 'edit'">
                        <div id="parent"></div>
                    </div>
                </form>
            </div>
            <form data-request-parent-form="#parent">
                <input name="search" value="term">
                <button id="trigger"></button>
            </form>
        `;

        const context = { el: document.getElementById('trigger'), options: { data: { page: 2 } } };
        document.getElementById('trigger').dispatchEvent(new CustomEvent('ajax:setup', { bubbles: true, detail: { context } }));

        expect(context.options.data).toEqual({ name: 'Ada', section: 'main', mode: 'edit', page: 2 });
    });

    test('other forms are left alone', () => {
        document.body.innerHTML = '<form><button id="trigger"></button></form>';

        const context = { el: document.getElementById('trigger'), options: { data: { page: 2 } } };
        document.getElementById('trigger').dispatchEvent(new CustomEvent('ajax:setup', { bubbles: true, detail: { context } }));

        expect(context.options.data).toEqual({ page: 2 });
    });
});
