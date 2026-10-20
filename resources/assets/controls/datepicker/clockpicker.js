/*
 * Clockpicker
 *
 * A jQuery-free fork of ClockPicker v0.0.7 (Wang Shenwei, MIT). The clock-face
 * SVG and geometry are unchanged; the DOM and event layer uses native APIs.
 *
 * Programmatic API:
 *
 *     const picker = new Clockpicker(inputEl, {
 *         twelvehour: false,
 *         autoclose: true,
 *         afterDone: () => { ... },
 *         afterHourSelect: () => { ... }
 *     });
 *     picker.hours;   // selected hour
 *     picker.amOrPm;  // "AM" | "PM"
 *     picker.hide();
 *     picker.remove();
 */
'use strict';

const svgNS = 'http://www.w3.org/2000/svg';

const svgSupported = 'SVGAngle' in window && (() => {
    const el = document.createElement('div');
    el.innerHTML = '<svg/>';
    const supported = (el.firstChild && el.firstChild.namespaceURI) === svgNS;
    el.innerHTML = '';
    return supported;
})();

const transitionSupported = 'transition' in document.createElement('div').style;

const touchSupported = 'ontouchstart' in window;

const vibrate = navigator.vibrate ? 'vibrate' : (navigator.webkitVibrate ? 'webkitVibrate' : null);

// Clock geometry (unchanged from the original)
const dialRadius = 100,
    outerRadius = 80,
    innerRadius = 54,
    tickRadius = 13,
    diameter = dialRadius * 2,
    duration = transitionSupported ? 350 : 1;

let idCounter = 0;

function uniqueId(prefix) {
    return prefix + (++idCounter);
}

function leadingZero(num) {
    return (num < 10 ? '0' : '') + num;
}

function createSvgElement(name) {
    return document.createElementNS(svgNS, name);
}

// Parses an HTML string into its first element node.
function parseHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
}

const TEMPLATE = [
    '<div class="popover clockpicker-popover">',
        '<div class="arrow"></div>',
        '<div class="popover-title">',
            '<span class="clockpicker-span-hours text-primary"></span>',
            ':',
            '<span class="clockpicker-span-minutes"></span> ',
            '<span class="clockpicker-span-am-pm"></span>',
        '</div>',
        '<div class="popover-content">',
            '<div class="clockpicker-plate">',
                '<div class="clockpicker-canvas"></div>',
                '<div class="clockpicker-dial clockpicker-hours"></div>',
                '<div class="clockpicker-dial clockpicker-minutes clockpicker-dial-out"></div>',
            '</div>',
            '<span class="clockpicker-am-pm-block"></span>',
        '</div>',
    '</div>'
].join('');

const DEFAULTS = {
    'default': '',
    fromnow: 0,
    placement: 'bottom',
    align: 'left',
    donetext: 'Done',
    autoclose: false,
    twelvehour: false,
    vibrate: true
};

export class Clockpicker {
    constructor(element, options) {
        this.options = Object.assign({}, DEFAULTS, options);
        this.id = uniqueId('cp');
        this.element = element;
        this.isAppended = false;
        this.isShown = false;
        this.currentView = 'hours';
        this.amOrPm = 'PM';

        const isInput = element.tagName === 'INPUT';
        this.isInput = isInput;
        this.input = isInput ? element : element.querySelector('input');
        this.addon = element.querySelector('.input-group-addon');

        const popover = parseHtml(TEMPLATE);
        this.popover = popover;
        this.plate = popover.querySelector('.clockpicker-plate');
        this.hoursView = popover.querySelector('.clockpicker-hours');
        this.minutesView = popover.querySelector('.clockpicker-minutes');
        this.amPmBlock = popover.querySelector('.clockpicker-am-pm-block');
        this.spanHours = popover.querySelector('.clockpicker-span-hours');
        this.spanMinutes = popover.querySelector('.clockpicker-span-minutes');
        this.spanAmPm = popover.querySelector('.clockpicker-span-am-pm');

        // Bound handlers kept for later removal
        this.onInputShow = this.show.bind(this);
        this.onAddonToggle = this.toggle.bind(this);
        this.onWinResize = () => { if (this.isShown) { this.locate(); } };
        this.onDocInteract = null;
        this.onDocKeyup = null;
        this.onDocMove = null;
        this.onDocUp = null;

        this.buildAmPm();
        this.buildDoneButton();

        this.normalizePlacement();
        popover.classList.add(this.options.placement);
        popover.classList.add('clockpicker-align-' + this.options.align);

        this.spanHours.addEventListener('click', () => this.toggleView('hours'));
        this.spanMinutes.addEventListener('click', () => this.toggleView('minutes'));

        this.input.addEventListener('focus', this.onInputShow);
        this.input.addEventListener('click', this.onInputShow);
        if (this.addon) {
            this.addon.addEventListener('click', this.onAddonToggle);
        }

        this.buildTicks();
        this.bindPlate();

        if (svgSupported) {
            this.buildCanvas();
        }

        this.raiseCallback(this.options.init);
    }

    raiseCallback(fn) {
        if (typeof fn === 'function') {
            fn();
        }
    }

    normalizePlacement() {
        const o = this.options;
        if ((o.placement === 'top' || o.placement === 'bottom' || o.placement === 'auto') &&
            (o.align === 'top' || o.align === 'bottom')) {
            o.align = 'left';
        }
        if ((o.placement === 'left' || o.placement === 'right') &&
            (o.align === 'left' || o.align === 'right')) {
            o.align = 'top';
        }
    }

    buildAmPm() {
        if (!this.options.twelvehour) {
            return;
        }

        const amButton = parseHtml('<button type="button" class="btn btn-sm btn-secondary clockpicker-button am-button">AM</button>');
        amButton.addEventListener('click', () => {
            this.amOrPm = 'AM';
            this.spanAmPm.textContent = 'AM';
        });
        this.amPmBlock.appendChild(amButton);

        const pmButton = parseHtml('<button type="button" class="btn btn-sm btn-secondary clockpicker-button pm-button">PM</button>');
        pmButton.addEventListener('click', () => {
            this.amOrPm = 'PM';
            this.spanAmPm.textContent = 'PM';
        });
        this.amPmBlock.appendChild(pmButton);
    }

    buildDoneButton() {
        if (this.options.autoclose) {
            return;
        }

        const doneButton = parseHtml('<button type="button" class="btn btn-sm btn-secondary w-100 clockpicker-button">' + this.options.donetext + '</button>');
        doneButton.addEventListener('click', () => this.done());
        this.popover.appendChild(doneButton);
    }

    buildTicks() {
        const onTickDown = (e) => this.mousedown(e, false);

        if (this.options.twelvehour) {
            for (let i = 1; i < 13; i += 1) {
                const radian = i / 6 * Math.PI;
                this.appendTick(this.hoursView, i, dialRadius + Math.sin(radian) * outerRadius - tickRadius,
                    dialRadius - Math.cos(radian) * outerRadius - tickRadius, onTickDown, '120%');
            }
        }
        else {
            for (let i = 0; i < 24; i += 1) {
                const radian = i / 6 * Math.PI,
                    inner = i > 0 && i < 13,
                    radius = inner ? innerRadius : outerRadius;
                const tick = this.appendTick(this.hoursView, i, dialRadius + Math.sin(radian) * radius - tickRadius,
                    dialRadius - Math.cos(radian) * radius - tickRadius, onTickDown);
                if (inner) {
                    tick.classList.add('tick-inner');
                }
            }
        }

        for (let i = 0; i < 60; i += 5) {
            const radian = i / 30 * Math.PI;
            this.appendTick(this.minutesView, leadingZero(i), dialRadius + Math.sin(radian) * outerRadius - tickRadius,
                dialRadius - Math.cos(radian) * outerRadius - tickRadius, onTickDown);
        }
    }

    appendTick(view, label, left, top, onDown, fontSize) {
        const tick = document.createElement('div');
        tick.className = 'clockpicker-tick';
        tick.style.left = left + 'px';
        tick.style.top = top + 'px';
        if (fontSize) {
            tick.style.fontSize = fontSize;
        }
        tick.textContent = label === 0 ? '00' : label;
        view.appendChild(tick);
        tick.addEventListener('mousedown', onDown);
        if (touchSupported) {
            tick.addEventListener('touchstart', onDown);
        }
        return tick;
    }

    bindPlate() {
        const onPlateDown = (e) => {
            if (!e.target.closest('.clockpicker-tick')) {
                this.mousedown(e, true);
            }
        };
        this.plate.addEventListener('mousedown', onPlateDown);
        if (touchSupported) {
            this.plate.addEventListener('touchstart', onPlateDown);
        }
    }

    buildCanvas() {
        const canvas = this.popover.querySelector('.clockpicker-canvas'),
            svg = createSvgElement('svg');
        svg.setAttribute('class', 'clockpicker-svg');
        svg.setAttribute('width', diameter);
        svg.setAttribute('height', diameter);

        const g = createSvgElement('g');
        g.setAttribute('transform', 'translate(' + dialRadius + ',' + dialRadius + ')');

        const bearing = createSvgElement('circle');
        bearing.setAttribute('class', 'clockpicker-canvas-bearing');
        bearing.setAttribute('cx', 0);
        bearing.setAttribute('cy', 0);
        bearing.setAttribute('r', 2);

        const hand = createSvgElement('line');
        hand.setAttribute('x1', 0);
        hand.setAttribute('y1', 0);

        const bg = createSvgElement('circle');
        bg.setAttribute('class', 'clockpicker-canvas-bg');
        bg.setAttribute('r', tickRadius);

        const fg = createSvgElement('circle');
        fg.setAttribute('class', 'clockpicker-canvas-fg');
        fg.setAttribute('r', 3.5);

        g.appendChild(hand);
        g.appendChild(bg);
        g.appendChild(fg);
        g.appendChild(bearing);
        svg.appendChild(g);
        canvas.appendChild(svg);

        this.hand = hand;
        this.bg = bg;
        this.fg = fg;
        this.bearing = bearing;
        this.g = g;
        this.canvas = canvas;
    }

    // Returns viewport-relative offset plus scroll, matching jQuery's offset().
    offset(el) {
        const rect = el.getBoundingClientRect();
        return {
            left: rect.left + window.pageXOffset,
            top: rect.top + window.pageYOffset
        };
    }

    mousedown(e, space) {
        const plateOffset = this.offset(this.plate),
            isTouch = /^touch/.test(e.type),
            x0 = plateOffset.left + dialRadius,
            y0 = plateOffset.top + dialRadius,
            point = isTouch ? e.touches[0] : e,
            dx = point.pageX - x0,
            dy = point.pageY - y0,
            z = Math.sqrt(dx * dx + dy * dy);
        let moved = false;

        if (space && (z < outerRadius - tickRadius || z > outerRadius + tickRadius)) {
            return;
        }
        e.preventDefault();

        // Drop any stale drag listeners from an interrupted drag
        this.unbindDrag();

        const movingTimer = setTimeout(() => {
            document.body.classList.add('clockpicker-moving');
        }, 200);

        if (svgSupported) {
            this.plate.appendChild(this.canvas);
        }

        this.setHand(dx, dy, !space, true);

        this.onDocMove = (ev) => {
            ev.preventDefault();
            const evTouch = /^touch/.test(ev.type),
                p = evTouch ? ev.touches[0] : ev,
                x = p.pageX - x0,
                y = p.pageY - y0;
            if (!moved && x === dx && y === dy) {
                return;
            }
            moved = true;
            this.setHand(x, y, false, true);
        };

        this.onDocUp = (ev) => {
            this.unbindDrag();
            ev.preventDefault();
            const evTouch = /^touch/.test(ev.type),
                p = evTouch ? ev.changedTouches[0] : ev,
                x = p.pageX - x0,
                y = p.pageY - y0;
            if ((space || moved) && x === dx && y === dy) {
                this.setHand(x, y);
            }
            if (this.currentView === 'hours') {
                this.toggleView('minutes', duration / 2);
            }
            else if (this.options.autoclose) {
                this.minutesView.classList.add('clockpicker-dial-out');
                setTimeout(() => this.done(), duration / 2);
            }
            if (svgSupported) {
                this.plate.insertBefore(this.canvas, this.plate.firstChild);
            }
            clearTimeout(movingTimer);
            document.body.classList.remove('clockpicker-moving');
        };

        // touchmove on document is passive by default, which would ignore the
        // preventDefault needed to stop the page scrolling during a drag
        document.addEventListener('mousemove', this.onDocMove);
        document.addEventListener('mouseup', this.onDocUp);
        if (touchSupported) {
            document.addEventListener('touchmove', this.onDocMove, { passive: false });
            document.addEventListener('touchend', this.onDocUp);
        }
    }

    unbindDrag() {
        if (this.onDocMove) {
            document.removeEventListener('mousemove', this.onDocMove);
            document.removeEventListener('touchmove', this.onDocMove);
            this.onDocMove = null;
        }
        if (this.onDocUp) {
            document.removeEventListener('mouseup', this.onDocUp);
            document.removeEventListener('touchend', this.onDocUp);
            this.onDocUp = null;
        }
    }

    toggle() {
        this[this.isShown ? 'hide' : 'show']();
    }

    locate() {
        const element = this.element,
            popover = this.popover,
            offset = this.offset(element),
            width = element.offsetWidth,
            height = element.offsetHeight,
            align = this.options.align,
            styles = {},
            viewportHeight = window.innerHeight || document.documentElement.clientHeight,
            scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let placement = this.options.placement;

        popover.style.display = 'block';

        if (placement === 'auto') {
            placement = (offset.top + popover.offsetHeight > viewportHeight + scrollTop) ? 'top' : 'bottom';
        }

        switch (placement) {
            case 'bottom':
                styles.top = offset.top + height;
                break;
            case 'right':
                styles.left = offset.left + width;
                break;
            case 'top':
                styles.top = offset.top - popover.offsetHeight;
                break;
            case 'left':
                styles.left = offset.left - popover.offsetWidth;
                break;
        }

        switch (align) {
            case 'left':
                styles.left = offset.left;
                break;
            case 'right':
                styles.left = offset.left + width - popover.offsetWidth;
                break;
            case 'top':
                styles.top = offset.top;
                break;
            case 'bottom':
                styles.top = offset.top + height - popover.offsetHeight;
                break;
        }

        if (styles.top !== undefined) {
            popover.style.top = styles.top + 'px';
        }
        if (styles.left !== undefined) {
            popover.style.left = styles.left + 'px';
        }
    }

    show() {
        if (this.isShown) {
            return;
        }

        this.raiseCallback(this.options.beforeShow);

        if (!this.isAppended) {
            document.body.appendChild(this.popover);
            window.addEventListener('resize', this.onWinResize);
            this.isAppended = true;
        }

        let value = ((this.input.value || this.options['default'] || '') + '');

        if (this.options.twelvehour) {
            const amPmValue = value.split(' ');
            if (amPmValue[1]) {
                value = amPmValue[0];
                this.amOrPm = amPmValue[1];
            }
        }

        let parts = value.split(':');
        if (parts[0] === 'now') {
            const now = new Date(Date.now() + this.options.fromnow);
            parts = [now.getHours(), now.getMinutes()];
        }

        this.hours = Number(parts[0]) || 0;
        this.minutes = Number(parts[1]) || 0;
        this.spanHours.textContent = leadingZero(this.hours);
        this.spanMinutes.textContent = leadingZero(this.minutes);
        if (this.options.twelvehour) {
            this.spanAmPm.textContent = this.amOrPm;
        }

        this.toggleView('hours');
        this.locate();
        this.isShown = true;

        this.onDocInteract = (e) => {
            const target = e.target;
            if (!this.popover.contains(target) &&
                !(this.addon && this.addon.contains(target)) &&
                target !== this.input) {
                this.hide();
            }
        };
        this.onDocKeyup = (e) => {
            if (e.keyCode === 27) {
                this.hide();
            }
        };
        document.addEventListener('click', this.onDocInteract);
        document.addEventListener('focusin', this.onDocInteract);
        document.addEventListener('keyup', this.onDocKeyup);

        this.raiseCallback(this.options.afterShow);
    }

    hide() {
        this.raiseCallback(this.options.beforeHide);

        this.isShown = false;

        if (this.onDocInteract) {
            document.removeEventListener('click', this.onDocInteract);
            document.removeEventListener('focusin', this.onDocInteract);
        }
        if (this.onDocKeyup) {
            document.removeEventListener('keyup', this.onDocKeyup);
        }

        this.popover.style.display = 'none';

        this.raiseCallback(this.options.afterHide);
    }

    toggleView(view, delay) {
        let raiseAfterHourSelect = false;
        if (view === 'minutes' && getComputedStyle(this.hoursView).visibility === 'visible') {
            this.raiseCallback(this.options.beforeHourSelect);
            raiseAfterHourSelect = true;
        }

        const isHours = view === 'hours',
            nextView = isHours ? this.hoursView : this.minutesView,
            hideView = isHours ? this.minutesView : this.hoursView;

        this.currentView = view;

        this.spanHours.classList.toggle('text-primary', isHours);
        this.spanMinutes.classList.toggle('text-primary', !isHours);

        hideView.classList.add('clockpicker-dial-out');
        nextView.style.visibility = 'visible';
        nextView.classList.remove('clockpicker-dial-out');

        this.resetClock(delay);

        clearTimeout(this.toggleViewTimer);
        this.toggleViewTimer = setTimeout(() => {
            hideView.style.visibility = 'hidden';
        }, duration);

        if (raiseAfterHourSelect) {
            this.raiseCallback(this.options.afterHourSelect);
        }
    }

    resetClock(delay) {
        const view = this.currentView,
            value = this[view],
            isHours = view === 'hours',
            unit = Math.PI / (isHours ? 6 : 30),
            radian = value * unit,
            radius = isHours && value > 0 && value < 13 ? innerRadius : outerRadius,
            x = Math.sin(radian) * radius,
            y = -Math.cos(radian) * radius;

        if (svgSupported && delay) {
            this.canvas.classList.add('clockpicker-canvas-out');
            setTimeout(() => {
                this.canvas.classList.remove('clockpicker-canvas-out');
                this.setHand(x, y);
            }, delay);
        }
        else {
            this.setHand(x, y);
        }
    }

    setHand(x, y, roundBy5, dragging) {
        let radian = Math.atan2(x, -y);
        const isHours = this.currentView === 'hours',
            unit = Math.PI / (isHours || roundBy5 ? 6 : 30),
            z = Math.sqrt(x * x + y * y),
            options = this.options,
            inner = isHours && z < (outerRadius + innerRadius) / 2;
        let radius = inner ? innerRadius : outerRadius,
            value;

        if (options.twelvehour) {
            radius = outerRadius;
        }

        if (radian < 0) {
            radian = Math.PI * 2 + radian;
        }

        value = Math.round(radian / unit);
        radian = value * unit;

        if (options.twelvehour) {
            if (isHours) {
                if (value === 0) {
                    value = 12;
                }
            }
            else {
                if (roundBy5) {
                    value *= 5;
                }
                if (value === 60) {
                    value = 0;
                }
            }
        }
        else if (isHours) {
            if (value === 12) {
                value = 0;
            }
            value = inner ? (value === 0 ? 12 : value) : (value === 0 ? 0 : value + 12);
        }
        else {
            if (roundBy5) {
                value *= 5;
            }
            if (value === 60) {
                value = 0;
            }
        }

        if (this[this.currentView] !== value && vibrate && this.options.vibrate) {
            if (!this.vibrateTimer) {
                navigator[vibrate](10);
                this.vibrateTimer = setTimeout(() => { this.vibrateTimer = null; }, 100);
            }
        }

        this[this.currentView] = value;
        this[isHours ? 'spanHours' : 'spanMinutes'].textContent = leadingZero(value);

        if (!svgSupported) {
            this[isHours ? 'hoursView' : 'minutesView'].querySelectorAll('.clockpicker-tick').forEach((tick) => {
                tick.classList.toggle('active', value === Number(tick.textContent));
            });
            return;
        }

        if (dragging || (!isHours && value % 5)) {
            this.g.insertBefore(this.hand, this.bearing);
            this.g.insertBefore(this.bg, this.fg);
            this.bg.setAttribute('class', 'clockpicker-canvas-bg clockpicker-canvas-bg-trans');
        }
        else {
            this.g.insertBefore(this.hand, this.bg);
            this.g.insertBefore(this.fg, this.bg);
            this.bg.setAttribute('class', 'clockpicker-canvas-bg');
        }

        const cx = Math.sin(radian) * radius,
            cy = -Math.cos(radian) * radius;
        this.hand.setAttribute('x2', cx);
        this.hand.setAttribute('y2', cy);
        this.bg.setAttribute('cx', cx);
        this.bg.setAttribute('cy', cy);
        this.fg.setAttribute('cx', cx);
        this.fg.setAttribute('cy', cy);
    }

    done() {
        this.raiseCallback(this.options.beforeDone);
        this.hide();

        const last = this.input.value;
        let value = leadingZero(this.hours) + ':' + leadingZero(this.minutes);

        if (this.options.twelvehour) {
            value = value + ' ' + this.amOrPm;
        }

        this.input.value = value;
        if (value !== last) {
            this.input.dispatchEvent(new Event('change', { bubbles: true }));
            if (!this.isInput) {
                this.element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        if (this.options.autoclose) {
            this.input.blur();
        }

        this.raiseCallback(this.options.afterDone);
    }

    remove() {
        this.input.removeEventListener('focus', this.onInputShow);
        this.input.removeEventListener('click', this.onInputShow);
        if (this.addon) {
            this.addon.removeEventListener('click', this.onAddonToggle);
        }
        if (this.isShown) {
            this.hide();
        }
        this.unbindDrag();
        clearTimeout(this.toggleViewTimer);
        if (this.isAppended) {
            window.removeEventListener('resize', this.onWinResize);
            this.popover.remove();
        }
    }
}
