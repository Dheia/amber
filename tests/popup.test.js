import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { Popup, registerPopup } from '../resources/assets/controls/popup/popup.js';

// Mirrors the Bootstrap 5 Modal surface the popup uses, firing its native events synchronously
class FakeModal {
    constructor(element, config) {
        this.element = element;
        this.config = config;
        FakeModal.instances.push(this);
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

    toggle() {
        this.element.classList.contains('show') ? this.hide() : this.show();
    }

    dispose() {
        this.disposed = true;
    }
}

FakeModal.instances = [];

function makeFakeJax() {
    class ControlBase {
        constructor(element) {
            this.element = element;
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
            return JSON.parse(value.replace(/([\w]+)\s*:/g, '"$1":'));
        },
        Events: {
            dispatch(name, { target = document, detail = {} } = {}) {
                target.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: true, detail }));
            }
        }
    };
}

// A request context whose default actions resolve, like larajax's decorated promises
function makeContext() {
    const resolved = () => {
        const promise = Promise.resolve();
        promise.done = (fn) => { promise.then(fn); return promise; };
        return promise;
    };

    return { success: resolved, error: resolved };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let jax;

beforeAll(() => {
    // happy-dom runs no scripts by default; the inline script test needs them
    window.happyDOM.settings.enableJavaScriptEvaluation = true;

    window.bootstrap = { Modal: FakeModal };
    jax = makeFakeJax();
    registerPopup(jax);
});

afterEach(() => {
    document.body.innerHTML = '';
    FakeModal.instances = [];
    jax.requests = [];
});

describe('popup content', () => {
    test('shows supplied content and registers the instance on its first div', () => {
        const popup = Popup.open({ content: '<div class="modal-body" id="body">Hello</div>' });

        expect(popup.container.isConnected).toBe(true);
        expect(popup.container.classList.contains('control-popup')).toBe(true);
        expect(popup.content.textContent).toContain('Hello');
        expect(Popup.getInstance(document.getElementById('body'))).toBe(popup);
        expect(Popup.getInstance(popup.container)).toBe(popup);
    });

    test('takes its size from the content', () => {
        const popup = Popup.open({ content: '<div data-popup-size="large">Sized</div>' });

        expect(popup.dialog.classList.contains('size-large')).toBe(true);
    });

    test('passes keyboard and size options from data attributes', () => {
        document.body.innerHTML = '<a id="link" data-control="popup" data-keyboard="false" data-size="small"></a>';
        const popup = Popup.fromElement(document.getElementById('link'), { content: '<div>Hi</div>' });

        expect(popup.modal.config).toEqual({ backdrop: false, keyboard: false, focus: false });
        expect(popup.dialog.classList.contains('size-small')).toBe(true);
    });

    test('runs inline scripts in the loaded content', () => {
        window.popupScriptRan = false;
        Popup.open({ content: '<div><script>window.popupScriptRan = true;</script></div>' });

        expect(window.popupScriptRan).toBe(true);
    });
});

describe('popup closing', () => {
    test('a data-dismiss element hides and removes the popup', () => {
        const popup = Popup.open({ content: '<div><button id="close" data-dismiss="popup">Close</button></div>' });
        const container = popup.container;

        document.getElementById('close').click();

        expect(container.isConnected).toBe(false);
        expect(Popup.getInstance(container)).toBe(null);
    });

    test('popup:close dispatched from inside the content closes it', () => {
        const popup = Popup.open({ content: '<div><span id="inner">Inner</span></div>' });
        const container = popup.container;

        document.getElementById('inner').dispatchEvent(new CustomEvent('popup:close', { bubbles: true }));

        expect(container.isConnected).toBe(false);
    });

    test('a locked popup does not hide', () => {
        const popup = Popup.open({ content: '<div>Locked</div>' });
        popup.lock(true);
        popup.hide();

        expect(popup.container.isConnected).toBe(true);
    });

    test('dispatches popup:show and popup:hidden on the trigger element', () => {
        document.body.innerHTML = '<a id="link"></a>';
        const link = document.getElementById('link');
        const events = [];
        ['popup:show', 'popup:hide', 'popup:hidden'].forEach((name) => link.addEventListener(name, () => events.push(name)));

        const popup = Popup.fromElement(link, { content: '<div>Hi</div>' });
        popup.hide();

        expect(events).toContain('popup:show');
        expect(events).toContain('popup:hidden');
        expect(Popup.getInstance(link)).toBe(null);
    });
});

describe('popup handler requests', () => {
    test('requests the handler from the trigger with the extra data, then shows the result', async () => {
        document.body.innerHTML = '<a id="link" data-handler="onLoadForm" data-extra-data="file_id: 5"></a>';
        const link = document.getElementById('link');

        const popup = Popup.fromElement(link);
        const request = jax.requests[0];

        expect(request.element).toBe(link);
        expect(request.handler).toBe('onLoadForm');
        expect(request.options.data).toEqual({ file_id: 5 });

        request.options.success.call(makeContext(), { result: '<div id="loaded">Loaded</div>' }, 200, null);
        await flush();

        expect(popup.content.querySelector('#loaded')).not.toBe(null);
    });

    test('a load indicator request hides the popup while it runs', () => {
        const popup = Popup.open({ content: '<div><button id="save" data-request="onSave" data-popup-load-indicator>Save</button></div>' });
        const button = document.getElementById('save');

        button.dispatchEvent(new CustomEvent('ajax:promise', { bubbles: true, detail: { context: { handler: 'onSave' } } }));
        expect(popup.container.classList.contains('show')).toBe(false);

        button.dispatchEvent(new CustomEvent('ajax:fail', { bubbles: true, detail: { context: { handler: 'onSave' } } }));
        expect(popup.container.classList.contains('show')).toBe(true);
        expect(popup.content.classList.contains('popup-shaking')).toBe(true);
    });
});

describe('popup stacker', () => {
    test('pushes the earlier popup back when another opens over it', () => {
        const first = Popup.open({ content: '<div>First</div>' });
        Popup.open({ content: '<div>Second</div>' });

        expect(first.content.style.transform).toContain('scale(.9)');
        expect(jax.popupStacker.getFirstPopup().textContent).toContain('Second');
    });

    test('pulls the earlier popup forward when the top one closes', () => {
        const first = Popup.open({ content: '<div>First</div>' });
        const second = Popup.open({ content: '<div>Second</div>' });

        second.hide();

        expect(first.content.style.transform).toBe('');
        expect(jax.popupStacker.getFirstPopup()).toBe(first.container);
    });
});
