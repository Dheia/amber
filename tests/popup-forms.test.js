import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { registerPopup } from '../resources/assets/controls/popup/popup.js';
import { registerRelationQuickCreate } from '../resources/assets/formwidgets/relation/relation-quick-create.js';
import { registerListWidget } from '../resources/assets/widgets/list/list.js';

class FakeModal {
    constructor(element, config) {
        this.element = element;
        this.config = config;
    }

    show() {
        if (!document.body.contains(this.element)) {
            document.body.append(this.element);
        }
        this.element.classList.add('show');
    }

    hide() {
        this.element.classList.remove('show');
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
                    this.config[key] = attr.value === 'true' ? true : attr.value;
                }
            }
        }

        // Supports listen(event, handler) and the delegated listen(event, selector, handler)
        listen(eventName, selectorOrHandler, handler) {
            if (typeof selectorOrHandler === 'string') {
                this.element.addEventListener(eventName, (ev) => {
                    if (ev.target.closest(selectorOrHandler)) {
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
        controls: new Map(),
        requests: [],
        ControlBase,
        registerControl(id, control) {
            this.controls.set(id, control);
        },
        fetchControl() {
            return null;
        },
        request(element, handler, options) {
            this.requests.push({ element, handler, options });
        },
        parseJSON(value) {
            return JSON.parse(value);
        },
        Events: {
            dispatch(name, { target = document, detail = {} } = {}) {
                target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
            }
        }
    };
}

let jax;

beforeAll(() => {
    window.bootstrap = { Modal: FakeModal };
    jax = makeFakeJax();
    registerPopup(jax);
    registerRelationQuickCreate(jax);
    registerListWidget(jax);
});

afterEach(() => {
    document.body.innerHTML = '';
    jax.requests = [];
});

function connectQuickCreate(extraAttributes = '') {
    document.body.innerHTML = `
        <div data-control="relation-quick-create" data-handler-load="formGroup::onLoadQuickCreateForm" data-quick-create-value="__quick_create__" ${extraAttributes}>
            <select name="group">
                <option value="">Select</option>
                <option value="__quick_create__">- Create New Group -</option>
                <option value="7" selected>Editors</option>
            </select>
        </div>
    `;

    const element = document.querySelector('[data-control="relation-quick-create"]');

    // happy-dom misreads the selected option when whitespace separates the options
    element.querySelector('select').value = '7';

    const control = new (jax.controls.get('relation-quick-create'))(element);
    control.init();
    control.connect();

    return { element, select: element.querySelector('select') };
}

describe('relation quick create', () => {
    test('picking the create option restores the selection and opens the form popup', () => {
        const { select } = connectQuickCreate();

        select.value = '__quick_create__';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(select.value).toBe('7');
        expect(jax.requests).toHaveLength(1);
        expect(jax.requests[0].handler).toBe('formGroup::onLoadQuickCreateForm');
        expect(jax.requests[0].options.data).toEqual({ _relation_quick_create: 1 });
    });

    test('a created record notifies dependent fields with a change event', () => {
        document.addEventListener('change', function onChange(ev) {
            document.removeEventListener('change', onChange);
            window.quickCreatedChange = ev.target.name;
        });

        const { element } = connectQuickCreate('data-quick-created="true"');

        expect(window.quickCreatedChange).toBe('group');
        expect(element.hasAttribute('data-quick-created')).toBe(false);
    });
});

describe('list popup forms', () => {
    test('listOnLoadForm opens the onLoadPopupForm handler with the record and context', () => {
        jax.listOnLoadForm('12', 'update');

        expect(jax.requests).toHaveLength(1);
        expect(jax.requests[0].handler).toBe('onLoadPopupForm');
        expect(jax.requests[0].options.data).toEqual({ form_record_id: '12', form_context: 'update' });
    });
});
