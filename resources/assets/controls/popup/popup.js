/*
 * Popup control
 *
 * Displays a modal popup built on the Bootstrap 5 Modal (a prerequisite), with
 * its content loaded from an AJAX handler, a URL, or supplied directly.
 *
 * Data attributes:
 * - data-control="popup" - opens a popup when the element is clicked
 * - data-handler="onLoadContent" - AJAX handler that returns the popup contents
 * - data-ajax="popup-content.htm" - URL to load the popup contents from
 * - data-extra-data="file_id: 1" - extra request data (data-request-data also applies)
 * - data-size="large" - popup size: giant, huge, large, small, tiny
 * - data-keyboard="false" - disallow closing the popup with the keyboard
 * - data-adaptive-height="true" - stretch the popup to the window height
 * - data-dismiss="popup" - inside a popup, closes it when clicked
 * - data-popup-load-indicator - inside a popup, on a request element, hides the popup
 *   behind the loading indicator while that request runs
 *
 * Events, dispatched on the trigger element and the popup's first content div with
 * detail { popup, trigger, modal }: popup:show, popup:shown, popup:hide, popup:hidden,
 * popup:complete, popup:error, popup:toggle, popup:download. Dispatching popup:close
 * on the popup container closes it.
 *
 * JavaScript API:
 *
 *     import { Popup } from './controls/popup/popup.js';
 *
 *     Popup.open({ handler: 'onLoadContent', extraData: { id: 3 } });
 *     Popup.fromElement(link, { ajax: 'popup-content.htm' });
 *     Popup.getInstance(element).hide();
 *     jax.popup.bindToPopups('#container', { file_id: 1 });
 *
 * Ported from October CMS (popup.js) as vanilla JS. The jQuery plugin and its
 * *.oc.popup events become the static API and popup:* CustomEvents.
 */
'use strict';

import { PopupStacker } from './popup-stacker.js';

// Framework instance bound by registerPopup
let jax = null;

// Popup instances keyed by trigger element, popup container and first content div
const instances = new WeakMap();

export class Popup
{
    static DEFAULTS = {
        ajax: null,
        handler: null,
        keyboard: true,
        extraData: {},
        content: null,
        size: null,
        adaptiveHeight: false,
        zIndex: null
    };

    constructor(element, options) {
        this.options = options;
        this.el = element;
        this.container = null;
        this.modal = null;
        this.backdrop = null;
        this.isOpen = false;
        this.isLoading = false;
        this.firstDiv = null;
        this.allowHide = true;
        this.dismissBound = false;
        this.listeners = [];

        instances.set(element, this);

        this.container = this.createPopupContainer();
        this.content = this.container.querySelector('.modal-content');
        this.dialog = this.container.querySelector('.modal-dialog');
        this.modal = new window.bootstrap.Modal(this.container, {
            backdrop: false,
            keyboard: this.options.keyboard,
            focus: false
        });

        this.initEvents();
        this.init();
    }

    init() {
        var self = this;

        // Do not allow the same popup to open twice
        if (self.isOpen) {
            return;
        }

        // Show loading panel
        this.setBackdrop(true);

        if (!this.options.content) {
            this.setLoading(true);
        }

        // Larajax AJAX
        if (this.options.handler) {
            jax.request(this.el, this.options.handler, {
                data: paramToObj('data-extra-data', this.options.extraData),
                success: function(data, statusCode, xhr) {
                    if (data instanceof Blob) {
                        if (self.isLoading) {
                            self.hideLoading();
                        }
                        else {
                            self.hide();
                        }
                        self.triggerEvent('popup:download');
                        this.success(data, statusCode, xhr);
                        return;
                    }

                    this.success(data, statusCode, xhr).done(() => {
                        self.setContent(data.result);
                        jax.Events.dispatch('ajax:update-complete', {
                            target: window,
                            detail: { context: this, data, responseCode: statusCode, xhr }
                        });
                        self.triggerEvent('popup:complete');
                    });
                },
                error: function(data, statusCode, xhr) {
                    this.error(data, statusCode, xhr).done(() => {
                        if (self.isLoading) {
                            self.hideLoading();
                        }
                        else {
                            self.hide();
                        }
                        self.triggerEvent('popup:error');
                    });
                },
                cancel: function() {
                    if (self.isLoading) {
                        self.hideLoading();
                    }
                    else {
                        self.hide();
                    }
                }
            });
        }
        // Regular AJAX
        else if (this.options.ajax) {
            const url = new URL(this.options.ajax, window.location.href);
            const data = paramToObj('data-extra-data', this.options.extraData);

            Object.entries(data).forEach(([key, value]) => url.searchParams.append(key, value));

            // Matches jQuery's cache: false
            url.searchParams.set('_', Date.now());

            fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                .then((response) => response.text())
                .then((html) => self.setContent(html));
        }
        // Specified content
        else if (this.options.content) {
            var content = typeof this.options.content == 'function'
                ? this.options.content.call(this.el, this)
                : this.options.content;

            this.setContent(content);
        }
    }

    initEvents() {
        // Duplicate the popup reference on the .control-popup container
        instances.set(this.container, this);

        // Hook in to BS Modal events
        this.listen('hide.bs.modal', () => {
            this.triggerEvent('popup:hide');
            this.isOpen = false;
            this.setBackdrop(false);
        });

        this.listen('hidden.bs.modal', () => {
            this.triggerEvent('popup:hidden');
            this.modal.dispose();
            this.container.remove();
            document.body.classList.remove('modal-open');
            this.dispose();
        });

        this.listen('show.bs.modal', () => {
            this.isOpen = true;
            this.setBackdrop(true);
            document.body.classList.add('modal-open');
        });

        this.listen('shown.bs.modal', () => {
            this.triggerEvent('popup:shown');
        });

        // Also closes when triggered from an element inside the popup
        this.listen('popup:close', (ev) => {
            this.hide();
            ev.preventDefault();
            ev.stopPropagation();
        }, false);

        jax.Events.dispatch('popup:show');
    }

    // Binds a container listener, by default ignoring events that bubble up from nested modals
    listen(eventName, handler, ownEventsOnly = true) {
        const listener = (ev) => {
            if (!ownEventsOnly || ev.target === this.container) {
                handler(ev);
            }
        };

        this.container.addEventListener(eventName, listener);
        this.listeners.push([eventName, listener]);
    }

    dispose() {
        this.listeners.forEach(([eventName, listener]) => {
            this.container.removeEventListener(eventName, listener);
        });
        this.listeners = [];

        if (this.dismissBound) {
            this.container.removeEventListener('click', this.onDismissClick);
        }

        instances.delete(this.el);
        instances.delete(this.container);

        if (this.firstDiv) {
            instances.delete(this.firstDiv);
        }

        this.container = null;
        this.content = null;
        this.dialog = null;
        this.modal = null;
        this.firstDiv = null;
        this.el = null;

        // In some cases options could contain callbacks,
        // so it's better to clean them up too.
        this.options = null;
    }

    createPopupContainer() {
        var
            modal = document.createElement('div'),
            modalDialog = document.createElement('div'),
            modalContent = document.createElement('div');

        modal.className = 'control-popup modal fade';
        modal.setAttribute('role', 'dialog');
        modal.tabIndex = -1;
        modalDialog.className = 'modal-dialog';
        modalContent.className = 'modal-content';

        if (this.options.size) {
            modalDialog.classList.add('size-' + this.options.size);
        }

        if (this.options.adaptiveHeight) {
            modalDialog.classList.add('adaptive-height');
        }

        if (this.options.zIndex !== null) {
            modal.style.zIndex = this.options.zIndex + 20;
        }

        modalDialog.appendChild(modalContent);
        modal.appendChild(modalDialog);

        return modal;
    }

    setContent(contents) {
        var contentNode = parseContents(contents),
            firstElement = contentNode.nodeType === Node.ELEMENT_NODE ? contentNode : contentNode.firstElementChild;

        // Set the popup size from the inner contents instead
        // of needing it from the calling code
        if (firstElement && firstElement.dataset.popupSize) {
            this.dialog.classList.add('size-' + firstElement.dataset.popupSize);
        }
        else {
            var defaultSize = contentNode.querySelector('[data-popup-size]');
            if (defaultSize) {
                this.dialog.classList.add('size-' + defaultSize.dataset.popupSize);
            }
        }

        this.setLoading(false);
        this.modal.show();
        this.content.replaceChildren(contentNode);
        activateScripts(this.content);
        this.triggerShowEvent();

        // Duplicate the popup object reference on to the first div
        // inside the popup. Eg: Popup.getInstance(firstDiv).hide()
        this.firstDiv = this.content.querySelector(':scope > div');
        if (this.firstDiv) {
            instances.set(this.firstDiv, this);
        }

        var defaultFocus = Array.from(this.content.querySelectorAll('[default-focus],[autofocus]'));
        if (defaultFocus.some(isVisible)) {
            window.setTimeout(function() {
                defaultFocus.forEach((el) => el.focus());
                defaultFocus = null;
            }, 300);
        }
    }

    setBackdrop(val) {
        if (val && !this.backdrop) {
            this.backdrop = document.createElement('div');
            this.backdrop.className = 'popup-backdrop fade';

            if (this.options.zIndex !== null) {
                this.backdrop.style.zIndex = this.options.zIndex;
            }

            document.body.appendChild(this.backdrop);

            this.backdrop.classList.add('show');

            var indicator = document.createElement('div');
            indicator.className = 'modal-content popup-loading-indicator';
            this.backdrop.appendChild(indicator);
        }
        else if (!val && this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
    }

    setLoading(val) {
        if (!this.backdrop) {
            return;
        }

        this.isLoading = val;

        if (val) {
            setTimeout(() => {
                if (this.backdrop) {
                    this.backdrop.classList.add('loading');
                }
            }, 100);
        }
        else {
            setTimeout(() => {
                if (this.backdrop) {
                    this.backdrop.classList.remove('loading');
                }
            }, 100);
        }
    }

    setShake() {
        var content = this.content;

        content.classList.add('popup-shaking');

        setTimeout(function() {
            content.classList.remove('popup-shaking');
        }, 1000);
    }

    hideLoading(val) {
        this.setLoading(false);

        // Wait for animations to complete
        var self = this;
        setTimeout(function() { self.setBackdrop(false) }, 250);
        setTimeout(function() { self.hide() }, 300);
    }

    triggerEvent(eventName, params) {
        var detail = Object.assign({
            popup: this,
            trigger: this.el,
            modal: this.container,
            relatedTarget: this.container
        }, params);

        this.el.dispatchEvent(new CustomEvent(eventName, { bubbles: true, cancelable: true, detail }));

        if (this.firstDiv) {
            this.firstDiv.dispatchEvent(new CustomEvent(eventName, { bubbles: true, cancelable: true, detail }));
        }
    }

    reload() {
        this.init();
    }

    show() {
        this.modal.show();
        this.triggerShowEvent();
    }

    triggerShowEvent() {
        if (!this.dismissBound) {
            this.onDismissClick = (ev) => {
                var dismiss = ev.target.closest('[data-dismiss="popup"]');
                if (dismiss && this.container.contains(dismiss)) {
                    this.hide();
                }
            };

            this.container.addEventListener('click', this.onDismissClick);
            this.dismissBound = true;
        }

        this.triggerEvent('popup:show');

        // Fixes an issue where the Modal makes `position: fixed` elements relative to itself
        // https://github.com/twbs/bootstrap/issues/15856
        this.dialog.style.transform = 'inherit';
    }

    hide() {
        if (!this.isOpen) return;

        this.triggerEvent('popup:hide');

        if (this.allowHide) {
            this.modal.hide();
        }

        // Fixes an issue where the Modal makes `position: fixed` elements relative to itself
        // https://github.com/twbs/bootstrap/issues/15856
        if (this.dialog) {
            this.dialog.style.transform = '';
        }
    }

    /*
     * Hide the popup without destroying it,
     * you should call .hide() once finished
     */
    visible(val) {
        if (val) {
            this.container.classList.add('show');
        }
        else {
            this.container.classList.remove('show');
        }

        this.setBackdrop(val);
    }

    toggle() {
        this.triggerEvent('popup:toggle');

        this.modal.toggle();
    }

    /*
     * Lock the popup from closing
     */
    lock(val) {
        this.allowHide = !val;
    }

    //
    // Static API
    //

    /**
     * getInstance returns the popup for a trigger element, popup container or first content div.
     */
    static getInstance(element) {
        return element ? instances.get(element) || null : null;
    }

    /**
     * fromElement creates the popup on first use, then reloads it or calls the named method.
     */
    static fromElement(element, option, ...args) {
        var data = instances.get(element);

        if (!data) {
            if (!Popup.isAvailable()) {
                return null;
            }

            var options = Object.assign({}, Popup.DEFAULTS, readDataOptions(element), typeof option == 'object' && option);
            data = new Popup(element, options);
        }
        else if (typeof option == 'string') {
            data[option].apply(data, args);
        }
        else {
            data.reload();
        }

        return data;
    }

    /**
     * open shows a popup without a trigger element.
     */
    static open(option) {
        return Popup.fromElement(document.createElement('a'), option);
    }

    /**
     * bindToPopups transfers the supplied variables as hidden form inputs to any popup
     * that is spawned within the supplied container. The spawned popup must contain a form element.
     */
    static bindToPopups(container, vars) {
        resolveElements(container).forEach((el) => {
            el.addEventListener('popup:show', (ev) => {
                var form = ev.detail.modal && ev.detail.modal.querySelector('form');
                if (!form) {
                    return;
                }

                Object.entries(vars).forEach(([name, value]) => {
                    var input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = name;
                    input.value = value;
                    form.prepend(input);
                });
            });
        });
    }

    /**
     * focusFirstInput focuses the first input when no other autofocus attribute is found,
     * using a delay to account for the CSS animations used by the modal.
     */
    static focusFirstInput(container) {
        setTimeout(function() {
            resolveElements(container).forEach((el) => {
                if (!el.querySelector('[default-focus],[autofocus]')) {
                    var input = el.querySelector('input.form-control');
                    if (input) {
                        input.focus();
                    }
                }
            });
        }, 310);
    }

    /**
     * isAvailable checks the Bootstrap 5 Modal prerequisite.
     */
    static isAvailable() {
        if (!window.bootstrap || !window.bootstrap.Modal) {
            console.error('[larajax.ui] The popup control requires the Bootstrap 5 bundle to be loaded.');
            return false;
        }

        return true;
    }
}

//
// Helpers
//

function paramToObj(name, value) {
    if (value === undefined || value === null) value = '';
    if (typeof value == 'object') return value;

    try {
        return jax.parseJSON("{" + value + "}");
    }
    catch (e) {
        throw new Error('Error parsing the '+name+' attribute value. '+e);
    }
}

// Reads data attributes with jQuery's data() type conversion
function readDataOptions(element) {
    var options = {};

    Object.entries(element.dataset || {}).forEach(([key, value]) => {
        if (value === 'true') {
            options[key] = true;
        }
        else if (value === 'false') {
            options[key] = false;
        }
        else if (value === 'null') {
            options[key] = null;
        }
        else if (value === +value + '') {
            options[key] = +value;
        }
        else if (/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/.test(value)) {
            try {
                options[key] = JSON.parse(value);
            }
            catch (e) {
                options[key] = value;
            }
        }
        else {
            options[key] = value;
        }
    });

    return options;
}

function parseContents(contents) {
    if (contents instanceof Node) {
        return contents;
    }

    var template = document.createElement('template');
    template.innerHTML = typeof contents == 'string' ? contents.trim() : '';

    return template.content;
}

// Inserted markup does not run its scripts, so recreate them as jQuery's html() would
function activateScripts(container) {
    container.querySelectorAll('script').forEach((oldScript) => {
        var script = document.createElement('script');

        Array.from(oldScript.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
        script.textContent = oldScript.textContent;
        oldScript.replaceWith(script);
    });
}

function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function resolveElements(container) {
    if (typeof container == 'string') {
        return Array.from(document.querySelectorAll(container));
    }

    return container ? [container] : [];
}

/*
 * Declarative binding, request loading indicator hooks and the jax.popup / jax.popupStacker globals
 */
export function registerPopup(framework) {
    jax = framework;

    jax.registerControl('popup', class extends jax.ControlBase {
        connect() {
            this.listen('click', this.onClick);
        }

        onClick(ev) {
            ev.preventDefault();

            Popup.fromElement(this.element);
        }
    });

    // Popup loading indicator will only show if the handlers are an exact match.
    function loadIndicatorFor(ev) {
        var el = ev.target instanceof Element ? ev.target.closest('[data-popup-load-indicator]') : null;

        if (!el || !ev.detail || !ev.detail.context || el.dataset.request !== ev.detail.context.handler) {
            return null;
        }

        return el;
    }

    function popupFor(el) {
        return Popup.getInstance(el.closest('.control-popup'));
    }

    // Prevent subsequent requests while loading (mis-doubleclick)
    document.addEventListener('ajax:setup', function(ev) {
        var el = loadIndicatorFor(ev);
        if (!el) return;

        var container = el.closest('.control-popup');
        if (!container || !container.classList.contains('show')) ev.preventDefault();
    });

    // Hide popup during AJAX
    document.addEventListener('ajax:promise', function(ev) {
        var el = loadIndicatorFor(ev);
        if (!el) return;

        var popup = popupFor(el);
        if (popup) {
            popup.container.classList.remove('show');
            popup.setLoading(true);
        }
    });

    // Request failed, show popup again
    document.addEventListener('ajax:fail', function(ev) {
        var el = loadIndicatorFor(ev);
        if (!el) return;

        var popup = popupFor(el);
        if (popup) {
            popup.container.classList.add('show');
            popup.setLoading(false);
            popup.setShake();
        }
    });

    // Request complete, hide loader
    document.addEventListener('ajax:done', function(ev) {
        var el = loadIndicatorFor(ev);
        if (!el) return;

        var popup = popupFor(el);
        popup && popup.hideLoading();
    });

    jax.popup = Popup;
    jax.popupStacker = new PopupStacker();
}
