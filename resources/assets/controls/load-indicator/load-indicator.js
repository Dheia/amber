/*
 * The loading indicator.
 *
 * The load indicator DIV is injected inside its container. The container should have
 * the relative position (use the loading-indicator-container class for it).
 *
 * JavaScript API:
 *
 * LoadIndicator.show(element, { text: 'Saving...', opaque: true }) - display the indicator in a solid (opaque) state
 * LoadIndicator.show(element, { centered: true }) - display the indicator aligned in the center horizontally
 * LoadIndicator.show(element, { size: 'small' }) - display the indicator in small size
 * LoadIndicator.show(element, { text: 'Saving...' }) - display the indicator in a transparent state
 * LoadIndicator.hide(element) - hide the indicator
 */
'use strict';

// Load indicator instances keyed by container element
const instances = new WeakMap();

export class LoadIndicator
{
    static DEFAULTS = {
        text: ''
    };

    constructor(element, options) {
        this.el = element;
        this.options = options || {};
        this.tally = 0;
        this.show();
    }

    hide() {
        this.tally--;

        if (this.tally <= 0) {
            this.el.querySelectorAll('div.loading-indicator').forEach((indicator) => indicator.remove());
            this.el.classList.remove('in-progress');
        }
    }

    show(options) {
        if (options) {
            this.options = options;
        }

        this.hide();

        var indicator = document.createElement('div'),
            text = document.createElement('div');

        indicator.className = 'loading-indicator';
        text.textContent = this.options.text || '';
        indicator.append(text, document.createElement('span'));

        if (this.options.opaque !== undefined) {
            indicator.classList.add('is-opaque');
        }
        if (this.options.centered !== undefined) {
            indicator.classList.add('indicator-center');
        }
        if (this.options.size === 'small') {
            indicator.classList.add('size-small');
        }

        this.el.prepend(indicator);
        this.el.classList.add('in-progress');

        this.tally++;
    }

    dispose() {
        instances.delete(this.el);
        this.el = null;
    }

    static show(element, options) {
        var config = Object.assign({}, LoadIndicator.DEFAULTS, options),
            instance = instances.get(element);

        if (instance) {
            instance.show(config);
            return instance;
        }

        instance = new LoadIndicator(element, config);
        instances.set(element, instance);
        return instance;
    }

    static hide(element) {
        var instance = instances.get(element);
        if (instance) {
            instance.hide();
        }
    }

    static getInstance(element) {
        return instances.get(element) || null;
    }
}
